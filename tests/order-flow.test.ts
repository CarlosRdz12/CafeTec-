import { beforeAll, describe, expect, it } from 'vitest'
import {
  changeOrderStatus,
  chargeOrder,
  createOrder,
  findOrderByCode,
  findOrderIdByToken,
  getOrderView,
  operationsBy,
} from '@/lib/server/order-service'
import { readDb } from '@/lib/server/store'
import { isQrToken, qrPayload } from '@/lib/domain/qr'
import type { PublicUser } from '@/lib/types'
import { firstProducts, makeUser } from './helpers'

let cajero: PublicUser
let cajero2: PublicUser

async function newOrder(buyer: PublicUser, paymentMethod: 'caja' | 'tarjeta_simulada' = 'caja') {
  const [p1, p2] = await firstProducts(2)
  return createOrder(buyer, { items: [{ productId: p1.id, quantity: 2 }, { productId: p2.id, quantity: 1 }], paymentMethod, notes: '' })
}

/** Fresh buyers per test: each buyer may have at most 3 active orders. */
async function buyers() {
  return { ana: await makeUser('cliente', 'Ana García López'), beto: await makeUser('cliente', 'Beto Ruiz') }
}

beforeAll(async () => {
  cajero = await makeUser('cajero', 'Carla Caja')
  cajero2 = await makeUser('cajero', 'Daniel Caja')
})

describe('1. pedido con QR', () => {
  it('creates an order with an opaque, unique QR token and server-side total', async () => {
    const { ana, beto } = await buyers()
    const [p1, p2] = await firstProducts(2)
    const order = await newOrder(ana)
    expect(isQrToken(order.qrToken)).toBe(true)
    expect(order.totalCents).toBe(p1.priceCents * 2 + p2.priceCents)
    // The QR payload carries only the token: no names, prices or items.
    const payload = qrPayload('http://localhost:3000', order.qrToken)
    expect(payload).not.toContain('Ana')
    expect(payload).not.toContain(String(order.totalCents))
    expect(payload).not.toContain(order.id)
    const other = await newOrder(beto)
    expect(other.qrToken).not.toBe(order.qrToken)
  })
})

describe('2/12. pedidos propios', () => {
  it('buyers only see their own orders', async () => {
    const { ana, beto } = await buyers()
    const order = await newOrder(ana)
    await expect(getOrderView(beto, order.id)).rejects.toThrow('Pedido no encontrado.')
    expect(await findOrderIdByToken(beto, order.qrToken)).toBeNull()
    expect(await findOrderIdByToken(ana, order.qrToken)).toBe(order.id)
    const view = await getOrderView(ana, order.id)
    expect(view.customerLabel).toBe('Ana García López')
  })
  it('buyers cannot charge or resolve codes of other orders', async () => {
    const { ana, beto } = await buyers()
    const order = await newOrder(ana)
    await expect(chargeOrder(beto, { orderId: order.id, method: 'tarjeta_simulada', card: 'aprobada', idempotencyKey: crypto.randomUUID() })).rejects.toThrow('Pedido no encontrado.')
    await expect(findOrderByCode(beto, order.qrToken)).rejects.toThrow('Pedido no encontrado.')
  })
})

describe('4/5/6. escaneo', () => {
  it('a valid QR returns current data with a masked buyer name', async () => {
    const { ana, beto } = await buyers()
    const order = await newOrder(ana)
    const found = await findOrderByCode(cajero, qrPayload('https://otro-host.mx', order.qrToken))
    expect(found.id).toBe(order.id)
    await changeOrderStatus(cajero, order.id, 'preparando')
    const view = await getOrderView(cajero, (await findOrderByCode(cajero, order.qrToken)).id)
    expect(view.status).toBe('preparando')
    expect(view.customerLabel).toBe('Ana G.')
    expect(JSON.stringify(view)).not.toContain('@cafetec.test')
  })
  it('a malformed code gives a clear error', async () => {
    const { ana, beto } = await buyers()
    await expect(findOrderByCode(cajero, 'https://example.com/anything')).rejects.toThrow('no es un QR de pedido de CafeTEC válido')
  })
  it('a well-formed but unknown token or folio reveals nothing', async () => {
    const { ana, beto } = await buyers()
    await expect(findOrderByCode(cajero, 'Z'.repeat(32))).rejects.toThrow('Este QR no corresponde a ningún pedido.')
    await expect(findOrderByCode(cajero, '#99999')).rejects.toThrow('No existe un pedido con ese folio.')
  })
  it('lookups by folio work as manual fallback', async () => {
    const { ana, beto } = await buyers()
    const order = await newOrder(beto)
    expect((await findOrderByCode(cajero, `#${order.number}`)).id).toBe(order.id)
  })
})

describe('7/8/9/10. pagos', () => {
  it('successful simulated payment records the transaction and updates the order', async () => {
    const { ana, beto } = await buyers()
    const order = await newOrder(ana, 'tarjeta_simulada')
    const { payment, order: updated } = await chargeOrder(ana, { orderId: order.id, method: 'tarjeta_simulada', card: 'aprobada', idempotencyKey: crypto.randomUUID(), expectedTotalCents: order.totalCents })
    expect(payment).toMatchObject({ result: 'exitoso', simulated: true, method: 'tarjeta_simulada', channel: 'comprador', amountCents: order.totalCents, userId: ana.id })
    expect(payment.reference).toMatch(/^SIM-[0-9A-F]{8}$/)
    expect(updated).toMatchObject({ paymentStatus: 'pagado', paidMethod: 'tarjeta_simulada', paymentId: payment.id })
    expect(updated.status).toBe('pendiente') // paid is tracked separately from preparation
  })

  it('a declined simulation keeps the order unpaid and allows retrying', async () => {
    const { ana, beto } = await buyers()
    const order = await newOrder(beto, 'tarjeta_simulada')
    const failed = await chargeOrder(beto, { orderId: order.id, method: 'tarjeta_simulada', card: 'rechazada', idempotencyKey: crypto.randomUUID() })
    expect(failed.payment.result).toBe('fallido')
    expect(failed.order.paymentStatus).toBe('pendiente')
    expect(failed.order.paymentId).toBeUndefined()
    const retry = await chargeOrder(beto, { orderId: order.id, method: 'tarjeta_simulada', card: 'aprobada', idempotencyKey: crypto.randomUUID() })
    expect(retry.order.paymentStatus).toBe('pagado')
  })

  it('a paid order cannot be charged again', async () => {
    const { ana, beto } = await buyers()
    const order = await newOrder(ana)
    await chargeOrder(cajero, { orderId: order.id, method: 'efectivo', idempotencyKey: crypto.randomUUID() })
    await expect(chargeOrder(cajero2, { orderId: order.id, method: 'tarjeta_simulada', card: 'aprobada', idempotencyKey: crypto.randomUUID() })).rejects.toThrow('ya está pagado')
    await expect(chargeOrder(ana, { orderId: order.id, method: 'tarjeta_simulada', card: 'aprobada', idempotencyKey: crypto.randomUUID() })).rejects.toThrow('ya está pagado')
  })

  it('two simultaneous charges by different cashiers produce exactly one successful payment', async () => {
    const { ana, beto } = await buyers()
    const order = await newOrder(beto)
    const results = await Promise.allSettled([
      chargeOrder(cajero, { orderId: order.id, method: 'efectivo', idempotencyKey: crypto.randomUUID() }),
      chargeOrder(cajero2, { orderId: order.id, method: 'tarjeta_simulada', card: 'aprobada', idempotencyKey: crypto.randomUUID() }),
      chargeOrder(beto, { orderId: order.id, method: 'tarjeta_simulada', card: 'aprobada', idempotencyKey: crypto.randomUUID() }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const db = await readDb()
    expect(db.payments.filter((p) => p.orderId === order.id && p.result === 'exitoso')).toHaveLength(1)
  })

  it('double click / retry with the same idempotency key does not create a second payment', async () => {
    const { ana, beto } = await buyers()
    const order = await newOrder(ana)
    const key = crypto.randomUUID()
    const [a, b] = await Promise.all([
      chargeOrder(cajero, { orderId: order.id, method: 'efectivo', idempotencyKey: key }),
      chargeOrder(cajero, { orderId: order.id, method: 'efectivo', idempotencyKey: key }),
    ])
    expect(a.payment.id).toBe(b.payment.id)
    expect(b.replayed).toBe(true)
    const db = await readDb()
    expect(db.payments.filter((p) => p.orderId === order.id)).toHaveLength(1)
  })

  it('rejects a charge when the confirmed amount differs from the server total', async () => {
    const { ana, beto } = await buyers()
    const order = await newOrder(ana)
    await expect(chargeOrder(cajero, { orderId: order.id, method: 'efectivo', idempotencyKey: crypto.randomUUID(), expectedTotalCents: 1 })).rejects.toThrow('El importe cambió')
  })
})

describe('13. estados finales', () => {
  it('delivered and cancelled orders cannot change state or be charged', async () => {
    const { ana, beto } = await buyers()
    const order = await newOrder(beto)
    await chargeOrder(cajero, { orderId: order.id, method: 'efectivo', idempotencyKey: crypto.randomUUID() })
    for (const s of ['preparando', 'listo', 'entregado'] as const) await changeOrderStatus(cajero, order.id, s)
    await expect(changeOrderStatus(cajero, order.id, 'listo')).rejects.toThrow('ya está entregado')
    const admin = await makeUser('admin')
    await expect(changeOrderStatus(admin, order.id, 'cancelado')).rejects.toThrow('ya está entregado')

    const cancelled = await newOrder(ana)
    await changeOrderStatus(ana, cancelled.id, 'cancelado')
    await expect(changeOrderStatus(cajero, cancelled.id, 'preparando')).rejects.toThrow('ya está cancelado')
    await expect(chargeOrder(cajero, { orderId: cancelled.id, method: 'efectivo', idempotencyKey: crypto.randomUUID() })).rejects.toThrow('cancelado')
  })

  it('delivery requires a successful payment', async () => {
    const { ana, beto } = await buyers()
    const order = await newOrder(ana)
    for (const s of ['preparando', 'listo'] as const) await changeOrderStatus(cajero, order.id, s)
    await expect(changeOrderStatus(cajero, order.id, 'entregado')).rejects.toThrow('Registra el pago')
  })

  it('cashier cannot cancel orders', async () => {
    const { ana, beto } = await buyers()
    const order = await newOrder(beto)
    await expect(changeOrderStatus(cajero, order.id, 'cancelado')).rejects.toThrow('no está permitido')
  })
})

describe('17. historial', () => {
  it('records who did what and when, per cashier', async () => {
    const { ana, beto } = await buyers()
    const order = await newOrder(ana)
    await findOrderByCode(cajero2, order.qrToken)
    await chargeOrder(cajero2, { orderId: order.id, method: 'efectivo', idempotencyKey: crypto.randomUUID() })
    await changeOrderStatus(cajero2, order.id, 'preparando')
    const db = await readDb()
    const ops = operationsBy(db, cajero2.id).filter((o) => o.orderId === order.id)
    expect(ops.map((o) => o.type).sort()).toEqual(['estado', 'pago_exitoso', 'qr_consultado'])
    expect(ops.find((o) => o.type === 'pago_exitoso')!.payment!.amountCents).toBe(order.totalCents)
    const stored = db.orders.find((o) => o.id === order.id)!
    expect(stored.chargedBy).toBe(cajero2.id)
    // Operations of one cashier are not mixed with another's.
    expect(operationsBy(db, cajero.id).some((o) => o.orderId === order.id)).toBe(false)
    const view = await getOrderView(ana, order.id)
    expect(view.timeline.map((e) => e.type)).toEqual(['creado', 'pago_exitoso', 'estado'])
  })
})
