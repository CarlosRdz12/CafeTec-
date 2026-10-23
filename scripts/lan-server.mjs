#!/usr/bin/env node
/**
 * Serves CafeTEC on the local network at https://cafetec.local:<port>.
 *
 * - Announces the name over mDNS (Bonjour/Avahi), so no DNS or hosts-file setup is needed.
 * - Uses HTTPS with a locally generated certificate authority, because phones only allow
 *   the camera (QR scanner) and Secure session cookies on secure origins.
 * - Accepts plain http:// on the same port and redirects it to https://.
 *
 * Usage: node scripts/lan-server.mjs [--dev]
 * Env:   PORT (3000), CAFETEC_HOSTNAME (cafetec.local), CAFETEC_LAN_IP, CAFETEC_DATA_DIR
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import path from 'node:path'
import { X509Certificate } from 'node:crypto'
import makeMdns from 'multicast-dns'
import QRCode from 'qrcode'
import selfsigned from 'selfsigned'
import { isTlsHandshake, lanAddresses, normalizeLocalHostname } from './lan-network.mjs'

const dev = process.argv.includes('--dev')
// Must be set before Next.js loads (cross-platform alternative to NODE_ENV=... in package.json).
process.env.NODE_ENV ??= dev ? 'development' : 'production'
const { default: next } = await import('next')
const port = Number(process.env.PORT ?? 3000)
const hostname = normalizeLocalHostname(process.env.CAFETEC_HOSTNAME)
const dataDir = process.env.CAFETEC_DATA_DIR ?? path.join(process.cwd(), '.data')
const certDir = path.join(dataDir, 'certs')
const CA_PATH = '/cafetec-ca.crt'

const candidates = lanAddresses()
const lanIp = process.env.CAFETEC_LAN_IP ?? candidates[0]?.address
if (!lanIp) {
  console.error('No se encontró una red local. Conéctate a una red Wi-Fi o Ethernet, o define CAFETEC_LAN_IP.')
  process.exit(1)
}

// ---------- Certificates: a local CA (installable on devices) signs the server certificate ----------

async function readPem(file) {
  try {
    return await readFile(path.join(certDir, file), 'utf8')
  } catch {
    return null
  }
}

function years(n) {
  const d = new Date()
  d.setFullYear(d.getFullYear() + n)
  return d
}

async function ensureCertificates() {
  await mkdir(certDir, { recursive: true })
  let caKey = await readPem('ca.key')
  let caCert = await readPem('ca.crt')
  if (!caKey || !caCert) {
    const ca = await selfsigned.generate([{ name: 'commonName', value: 'CafeTEC Red Local CA' }, { name: 'organizationName', value: 'CafeTEC' }], {
      keySize: 2048,
      algorithm: 'sha256',
      notAfterDate: years(10),
      extensions: [
        { name: 'basicConstraints', cA: true, pathLenConstraint: 0, critical: true },
        { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
      ],
    })
    ;[caKey, caCert] = [ca.private, ca.cert]
    await writeFile(path.join(certDir, 'ca.key'), caKey, { mode: 0o600 })
    await writeFile(path.join(certDir, 'ca.crt'), caCert)
  }

  // The server certificate is reissued when the name or LAN IP changes, or when it is about to expire.
  const wanted = [hostname, 'localhost', lanIp, '127.0.0.1']
  let key = await readPem('server.key')
  let cert = await readPem('server.crt')
  if (cert) {
    const x509 = new X509Certificate(cert)
    const san = x509.subjectAltName ?? ''
    const expiresSoon = new Date(x509.validTo).getTime() - Date.now() < 30 * 86_400_000
    const signedByCa = x509.checkIssued(new X509Certificate(caCert))
    if (expiresSoon || !signedByCa || !wanted.every((name) => san.includes(name))) cert = null
  }
  if (!key || !cert) {
    const notAfter = new Date(Date.now() + 397 * 86_400_000) // within the limit browsers accept for leaf certificates
    const leaf = await selfsigned.generate([{ name: 'commonName', value: hostname }], {
      keySize: 2048,
      algorithm: 'sha256',
      notAfterDate: notAfter,
      ca: { key: caKey, cert: caCert },
      extensions: [
        { name: 'basicConstraints', cA: false, critical: true },
        { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
        { name: 'extKeyUsage', serverAuth: true },
        {
          name: 'subjectAltName',
          altNames: [
            { type: 2, value: hostname },
            { type: 2, value: 'localhost' },
            { type: 7, ip: lanIp },
            { type: 7, ip: '127.0.0.1' },
          ],
        },
      ],
    })
    ;[key, cert] = [leaf.private, leaf.cert]
    await writeFile(path.join(certDir, 'server.key'), key, { mode: 0o600 })
    await writeFile(path.join(certDir, 'server.crt'), cert)
  }
  return { key, cert: `${cert.trim()}\n${caCert.trim()}\n`, caCert }
}

// ---------- mDNS: answer "cafetec.local" with this computer's LAN IP ----------

function startMdns() {
  // Bind to all addresses: a socket bound to the unicast IP would not receive multicast queries on Linux.
  const mdns = makeMdns({ interface: lanIp, bind: '0.0.0.0', reuseAddr: true })
  const answer = { name: hostname, type: 'A', ttl: 120, flush: true, data: lanIp }
  mdns.on('query', (query, rinfo) => {
    const questions = query.questions.filter((q) => q.name.toLowerCase() === hostname && (q.type === 'A' || q.type === 'ANY'))
    if (questions.length === 0) return
    if (rinfo.port === 5353) return mdns.respond({ answers: [answer] })
    // "Legacy unicast" query from a plain DNS resolver: reply directly, echoing id and question (RFC 6762 §6.7).
    mdns.respond({ id: query.id, questions, answers: [{ ...answer, flush: false, ttl: 10 }] }, rinfo)
  })
  mdns.on('warning', (err) => console.warn('[mdns]', err.message))
  mdns.on('error', (err) => console.warn(`[mdns] No se pudo anunciar ${hostname}: ${err.message}. Usa la dirección IP.`))
  // Unsolicited announcement so devices refresh any stale cache right away.
  mdns.on('ready', () => mdns.respond({ answers: [answer] }))
  return mdns
}

// ---------- HTTP(S) on a single port ----------

async function main() {
  const { key, cert, caCert } = await ensureCertificates()

  const app = next({ dev, dir: process.cwd(), hostname, port })
  await app.prepare()
  const handle = app.getRequestHandler()

  const secure = https.createServer({ key, cert }, (req, res) => {
    if (req.url === CA_PATH) return sendCa(res)
    req.headers['x-forwarded-proto'] = 'https'
    handle(req, res)
  })
  if (dev) secure.on('upgrade', app.getUpgradeHandler()) // hot reload websocket

  // Plain http:// requests (e.g. someone types "cafetec.local:3000") are redirected to https://.
  const plain = http.createServer((req, res) => {
    if (req.url === CA_PATH) return sendCa(res)
    const host = req.headers.host ?? `${hostname}:${port}`
    res.writeHead(308, { Location: `https://${host}${req.url ?? '/'}` })
    res.end()
  })

  function sendCa(res) {
    res.writeHead(200, {
      'Content-Type': 'application/x-x509-ca-cert',
      'Content-Disposition': 'attachment; filename="cafetec-ca.crt"',
    })
    res.end(caCert)
  }

  const listener = net.createServer((socket) => {
    socket.once('data', (chunk) => {
      socket.pause()
      socket.unshift(chunk)
      ;(isTlsHandshake(chunk) ? secure : plain).emit('connection', socket)
      process.nextTick(() => socket.resume())
    })
    socket.on('error', () => socket.destroy())
  })

  listener.listen(port, '0.0.0.0', async () => {
    const mdns = startMdns()
    const nameUrl = `https://${hostname}:${port}`
    const ipUrl = `https://${lanIp}:${port}`
    const qr = await QRCode.toString(ipUrl, { type: 'terminal', small: true })
    console.log(`
  ☕ CafeTEC en la red local ${dev ? '(desarrollo)' : ''}

     Nombre:   ${nameUrl}
     IP:       ${ipUrl}
     Este equipo: https://localhost:${port}

  Escanea este QR con el teléfono (abre la versión por IP, funciona en cualquier dispositivo):
${qr}
  La primera vez el navegador avisará que el certificado no es de confianza: elige
  "Avanzado → Continuar". Para quitar el aviso, instala el certificado de CafeTEC en el
  dispositivo desde http://${hostname}:${port}${CA_PATH}  (ver README).
${candidates.length > 1 ? `\n  Otras IP detectadas: ${candidates.slice(1).map((c) => `${c.address} (${c.name})`).join(', ')}. Para usar otra: CAFETEC_LAN_IP=<ip>\n` : ''}`)

    const shutdown = () => {
      mdns.destroy()
      listener.close(() => process.exit(0))
      setTimeout(() => process.exit(0), 2000).unref()
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  })

  listener.on('error', (err) => {
    console.error(err.code === 'EADDRINUSE' ? `El puerto ${port} está ocupado. Usa otro con PORT=<puerto>.` : err)
    process.exit(1)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
