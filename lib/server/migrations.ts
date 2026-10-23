import { randomBytes, randomUUID } from 'node:crypto'
import type { Database, Order } from '@/lib/types'

export const CURRENT_VERSION = 2

export class IntegrityError extends Error {}

export function newQrToken() {
  // 192 bits of randomness, URL-safe: opaque and infeasible to guess.
  return randomBytes(24).toString('base64url')
}

type AnyDatabase = Omit<Database, 'version' | 'payments' | 'orderEvents' | 'orders'> & {
  version: number
  orders: (Omit<Order, 'qrToken'> & { qrToken?: string })[]
  payments?: Database['payments']
  orderEvents?: Database['orderEvents']
}

/**
 * Upgrades a stored database to the current schema without dropping data.
 * Each step only adds collections or fields; existing values are preserved.
 */
export function migrate(raw: AnyDatabase): { db: Database; migrated: boolean } {
  const startVersion = raw.version ?? 1
  if (startVersion > CURRENT_VERSION) {
    throw new IntegrityError(`El archivo de datos usa la versión ${startVersion}, más nueva que esta aplicación.`)
  }

  if (startVersion < 2) {
    // v1 -> v2: payments, order history and QR tokens.
    raw.payments ??= []
    raw.orderEvents ??= []
    for (const order of raw.orders) {
      order.qrToken ??= newQrToken()
      raw.orderEvents.push({
        id: randomUUID(),
        orderId: order.id,
        type: 'creado',
        toStatus: order.status,
        userId: order.userId,
        role: 'cliente',
        note: 'Pedido registrado antes de la migración v2',
        createdAt: order.createdAt,
      })
    }
    raw.version = 2
  }

  return { db: raw as Database, migrated: startVersion !== CURRENT_VERSION }
}

/**
 * Integrity constraints checked before every write, playing the role of
 * unique indexes and foreign keys: a violating mutation is never persisted.
 */
export function assertIntegrity(db: Database) {
  const orderIds = new Set<string>()
  const tokens = new Set<string>()
  const numbers = new Set<number>()
  for (const order of db.orders) {
    if (orderIds.has(order.id)) throw new IntegrityError(`Pedido duplicado ${order.id}`)
    if (!order.qrToken || tokens.has(order.qrToken)) throw new IntegrityError(`Token QR inválido o duplicado en pedido ${order.number}`)
    if (numbers.has(order.number)) throw new IntegrityError(`Folio duplicado ${order.number}`)
    orderIds.add(order.id)
    tokens.add(order.qrToken)
    numbers.add(order.number)
  }

  const paymentIds = new Set<string>()
  const paidOrders = new Set<string>()
  const idempotency = new Set<string>()
  for (const payment of db.payments) {
    if (paymentIds.has(payment.id)) throw new IntegrityError(`Transacción duplicada ${payment.id}`)
    paymentIds.add(payment.id)
    if (!orderIds.has(payment.orderId)) throw new IntegrityError(`Pago ${payment.id} sin pedido`)
    const key = `${payment.orderId}:${payment.idempotencyKey}`
    if (idempotency.has(key)) throw new IntegrityError(`Clave de idempotencia repetida ${key}`)
    idempotency.add(key)
    if (payment.result === 'exitoso') {
      if (paidOrders.has(payment.orderId)) throw new IntegrityError(`Cobro exitoso duplicado para el pedido ${payment.orderId}`)
      paidOrders.add(payment.orderId)
    }
  }

  for (const order of db.orders) {
    if (order.paymentId && !paidOrders.has(order.id)) throw new IntegrityError(`Pedido ${order.number} referencia un pago inexistente`)
  }
  for (const event of db.orderEvents) {
    if (!orderIds.has(event.orderId)) throw new IntegrityError(`Evento ${event.id} sin pedido`)
  }
}
