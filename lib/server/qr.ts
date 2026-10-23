import 'server-only'
import { headers } from 'next/headers'
import QRCode from 'qrcode'
import { qrPayload } from '@/lib/domain/qr'

/** Public base URL for QR links. Set CAFETEC_PUBLIC_URL when serving behind a proxy or on a LAN. */
async function publicOrigin() {
  if (process.env.CAFETEC_PUBLIC_URL) return process.env.CAFETEC_PUBLIC_URL
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

/**
 * Renders the order QR. The payload is only `<origin>/q/<token>`: no names,
 * prices or items. Scanning it asks the server for current, authorized data.
 */
export async function renderOrderQr(token: string) {
  const payload = qrPayload(await publicOrigin(), token)
  const options = { errorCorrectionLevel: 'M' as const, margin: 2, color: { dark: '#2b1d14', light: '#ffffff' } }
  const [svg, png] = await Promise.all([
    QRCode.toString(payload, { ...options, type: 'svg' }),
    QRCode.toDataURL(payload, { ...options, width: 720 }),
  ])
  return { svgDataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, pngDataUrl: png }
}
