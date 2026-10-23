import { describe, expect, it } from 'vitest'
import { isTlsHandshake, lanAddresses, normalizeLocalHostname } from '../scripts/lan-network.mjs'

describe('servidor en red local', () => {
  it('prefers the Wi-Fi/Ethernet address over virtual adapters and loopback', () => {
    const list = lanAddresses({
      lo: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
      'vEthernet (WSL)': [{ family: 'IPv4', address: '172.20.0.1', internal: false }],
      docker0: [{ family: 'IPv4', address: '172.17.0.1', internal: false }],
      'Wi-Fi': [
        { family: 'IPv4', address: '192.168.1.40', internal: false },
        { family: 'IPv6', address: 'fe80::1', internal: false },
      ],
      eth9: [{ family: 'IPv4', address: '169.254.3.3', internal: false }],
    } as never)
    expect(list[0].address).toBe('192.168.1.40')
    expect(list.map((a: { address: string }) => a.address)).not.toContain('127.0.0.1')
    expect(list.map((a: { address: string }) => a.address)).not.toContain('169.254.3.3')
  })
  it('only accepts .local names', () => {
    expect(normalizeLocalHostname('CafeTec.local')).toBe('cafetec.local')
    expect(normalizeLocalHostname()).toBe('cafetec.local')
    expect(() => normalizeLocalHostname('cafetec.com')).toThrow()
    expect(() => normalizeLocalHostname('mi cafe.local')).toThrow()
  })
  it('detects TLS vs plain HTTP on the shared port', () => {
    expect(isTlsHandshake(Buffer.from([0x16, 0x03, 0x01]))).toBe(true)
    expect(isTlsHandshake(Buffer.from('GET / HTTP/1.1'))).toBe(false)
  })
})
