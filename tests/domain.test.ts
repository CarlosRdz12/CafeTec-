import { describe, expect, it } from 'vitest'
import { canTransition, computeOrderTotal, maskCustomerName, nextStatuses } from '@/lib/domain/orders'
import { allowedChargeMethods, chargeBlocker, DEMO_CARDS, simulateCardAuthorization } from '@/lib/domain/payments'
import { parseOrderCode, qrPayload } from '@/lib/domain/qr'

const TOKEN = 'abcdefghijklmnopqrstuvwxyz012345' // 32 chars

describe('parseOrderCode', () => {
  it('reads a CafeTEC QR URL from any host', () => {
    expect(parseOrderCode(qrPayload('https://cafe.example.mx', TOKEN))).toEqual({ kind: 'token', token: TOKEN })
    expect(parseOrderCode(`http://192.168.0.10:3000/q/${TOKEN}/`)).toEqual({ kind: 'token', token: TOKEN })
  })
  it('reads bare tokens and folios', () => {
    expect(parseOrderCode(TOKEN)).toEqual({ kind: 'token', token: TOKEN })
    expect(parseOrderCode('#0012')).toEqual({ kind: 'folio', number: 12 })
    expect(parseOrderCode(' 7 ')).toEqual({ kind: 'folio', number: 7 })
  })
  it('rejects anything else', () => {
    for (const bad of ['', 'hola', '#0', 'https://evil.example/pay?id=1', 'https://x.mx/q/short', 'x'.repeat(400), 'WIFI:S:red;;']) {
      expect(parseOrderCode(bad)).toEqual({ kind: 'invalid' })
    }
  })
})

describe('order transitions', () => {
  it('cashier only moves orders forward and never cancels', () => {
    const cajero = { role: 'cajero' as const, isOwner: false }
    expect(canTransition('pendiente', 'preparando', cajero)).toBe(true)
    expect(canTransition('preparando', 'listo', cajero)).toBe(true)
    expect(canTransition('listo', 'entregado', cajero)).toBe(true)
    expect(canTransition('pendiente', 'cancelado', cajero)).toBe(false)
    expect(canTransition('pendiente', 'entregado', cajero)).toBe(false)
    expect(nextStatuses('pendiente', 'cajero')).toEqual(['preparando'])
  })
  it('closed orders accept no transition for anyone', () => {
    for (const role of ['cliente', 'personal', 'cajero', 'admin'] as const) {
      for (const to of ['pendiente', 'preparando', 'listo', 'entregado', 'cancelado'] as const) {
        expect(canTransition('entregado', to, { role, isOwner: true })).toBe(false)
        expect(canTransition('cancelado', to, { role, isOwner: true })).toBe(false)
      }
    }
  })
  it('keeps the existing staff and buyer rules', () => {
    expect(canTransition('listo', 'cancelado', { role: 'personal', isOwner: false })).toBe(true)
    expect(canTransition('pendiente', 'cancelado', { role: 'cliente', isOwner: true })).toBe(true)
    expect(canTransition('pendiente', 'cancelado', { role: 'cliente', isOwner: false })).toBe(false)
    expect(canTransition('preparando', 'cancelado', { role: 'cliente', isOwner: true })).toBe(false)
  })
})

describe('payments', () => {
  it('demo cards are scenarios, not card numbers', () => {
    for (const card of DEMO_CARDS) expect(card.masked).not.toMatch(/\d{4}/)
    expect(simulateCardAuthorization('aprobada')).toEqual({ approved: true })
    expect(simulateCardAuthorization('rechazada')).toMatchObject({ approved: false })
  })
  it('limits charge methods by role', () => {
    expect(allowedChargeMethods('cliente')).toEqual(['tarjeta_simulada'])
    expect(allowedChargeMethods('cajero')).toEqual(['efectivo', 'tarjeta_simulada'])
    expect(allowedChargeMethods('personal')).toEqual(['efectivo'])
  })
  it('blocks charging paid, cancelled or delivered orders', () => {
    expect(chargeBlocker({ status: 'pendiente', paymentStatus: 'pendiente' })).toBeNull()
    expect(chargeBlocker({ status: 'listo', paymentStatus: 'pagado' })).toMatch(/ya está pagado/)
    expect(chargeBlocker({ status: 'cancelado', paymentStatus: 'pendiente' })).toMatch(/cancelado/)
    expect(chargeBlocker({ status: 'entregado', paymentStatus: 'pendiente' })).toMatch(/entregado/)
  })
})

describe('helpers', () => {
  it('masks buyer names for the counter', () => {
    expect(maskCustomerName('Ana García López')).toBe('Ana G.')
    expect(maskCustomerName('Beto')).toBe('Beto')
  })
  it('computes totals from stored lines', () => {
    expect(computeOrderTotal([{ productId: 'a', name: 'A', unitPriceCents: 2500, quantity: 2 }, { productId: 'b', name: 'B', unitPriceCents: 1500, quantity: 1 }])).toBe(6500)
  })
})
