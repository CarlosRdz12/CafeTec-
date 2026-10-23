/** Path served by `app/q/[token]`; the QR only ever carries this opaque token. */
export const QR_PATH_PREFIX = '/q/'

const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/

export function isQrToken(value: string) {
  return TOKEN_RE.test(value)
}

export function qrPayload(origin: string, token: string) {
  return `${origin.replace(/\/$/, '')}${QR_PATH_PREFIX}${token}`
}

export type ParsedOrderCode = { kind: 'token'; token: string } | { kind: 'folio'; number: number } | { kind: 'invalid' }

/**
 * Accepts what a cashier may scan or type: a CafeTEC QR URL (any host),
 * a bare token, or a folio such as "#0012" / "12".
 */
export function parseOrderCode(input: string): ParsedOrderCode {
  const text = input.trim()
  if (!text || text.length > 300) return { kind: 'invalid' }

  const folio = /^#?\s*(\d{1,7})$/.exec(text)
  if (folio) {
    const number = Number(folio[1])
    return number > 0 ? { kind: 'folio', number } : { kind: 'invalid' }
  }

  if (isQrToken(text)) return { kind: 'token', token: text }

  try {
    const url = new URL(text)
    const match = /^\/q\/([^/]+)\/?$/.exec(url.pathname)
    if (match && isQrToken(match[1])) return { kind: 'token', token: match[1] }
  } catch {
    // not a URL
  }
  return { kind: 'invalid' }
}
