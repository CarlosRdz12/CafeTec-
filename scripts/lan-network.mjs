// Helpers for serving CafeTEC on the local network (used by scripts/lan-server.mjs).
import os from 'node:os'

// Adapters that are rarely reachable from phones on the same Wi-Fi.
const VIRTUAL_ADAPTER = /docker|veth|br-|virbr|vbox|virtualbox|vmware|vmnet|hyper-v|vethernet|wsl|utun|tun|tap|zerotier|tailscale|loopback/i

function isPrivateIPv4(ip) {
  return /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
}

/** Lists IPv4 addresses that other devices on the LAN can likely reach, best first. */
export function lanAddresses(interfaces = os.networkInterfaces()) {
  const found = []
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs ?? []) {
      if (addr.family !== 'IPv4' && addr.family !== 4) continue
      if (addr.internal || addr.address.startsWith('169.254.')) continue
      found.push({ name, address: addr.address, score: (isPrivateIPv4(addr.address) ? 2 : 0) + (VIRTUAL_ADAPTER.test(name) ? 0 : 1) })
    }
  }
  return found.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}

/** Validates the hostname to announce. mDNS names must end in ".local". */
export function normalizeLocalHostname(value = 'cafetec.local') {
  const host = value.trim().toLowerCase().replace(/\.$/, '')
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.local$/.test(host)) {
    throw new Error(`CAFETEC_HOSTNAME debe ser un nombre como "cafetec.local" (recibido: "${value}")`)
  }
  return host
}

/** True when the first byte of a connection is a TLS handshake record. */
export function isTlsHandshake(firstChunk) {
  return firstChunk.length > 0 && firstChunk[0] === 0x16
}
