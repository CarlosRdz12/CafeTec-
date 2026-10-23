import 'server-only'
import { randomBytes } from 'node:crypto'
import {
  buildOrderItems,
  canTransition,
  computeOrderTotal,
  DomainError,
  isActiveStatus,
  MAX_ACTIVE_ORDERS_PER_USER,
  maskCustomerName,
  type CartLine,
} from '@/lib/domain/orders'
import { allowedChargeMethods, chargeBlocker, simulateCardAuthorization, type DemoCardId } from '@/lib/domain/payments'
import { parseOrderCode } from '@/lib/domain/qr'
import { newQrToken } from './migrations'
import { mutateDb, newId, readDb } from './store'
import type {
  Category,
  ChargeMethod,
  Database,
  Order,
  OrderEvent,
  OrderEventType,
  OrderStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  PublicUser,
  Role,
} from '@/lib/types'

export type Actor = Pick<PublicUser, 'id' | 'name' | 'role'>

const STAFF_ROLES: Role[] = ['personal', 'cajero', 'admin']
const NOT_FOUND = 'Pedido no encontrado.'

export function isStaff(role: Role) {
  return STAFF_ROLES.includes(role)
}

/** Staff can see any order; buyers only their own. Unauthorized looks exactly like missing. */
function findVisibleOrder(db: Database, actor: Actor, orderId: string) {
  const order = db.orders.find((o) => o.id === orderId)
  if (!order || (!isStaff(actor.role) && order.userId !== actor.id)) throw new DomainError(NOT_FOUND)
  return order
}

function logEvent(
  db: Database,
  actor: Actor,
  order: Order,
  type: OrderEventType,
  extra: Partial<Pick<OrderEvent, 'fromStatus' | 'toStatus' | 'paymentId' | 'note'>> = {},
  at = new Date().toISOString(),
) {
  db.orderEvents.push({ id: newId(), orderId: order.id, type, userId: actor.id, role: actor.role, note: '', createdAt: at, ...extra })
}

function restoreStock(db: Database, order: Order, userId: string) {
  for (const item of order.items) {
    const product = db.products.find((p) => p.id === item.productId)
    if (!product) continue
    product.stock += item.quantity
    product.updatedAt = new Date().toISOString()
    db.movements.push({
      id: newId(),
      productId: product.id,
      delta: item.quantity,
      reason: 'cancelacion',
      note: `Pedido #${order.number} cancelado`,
      userId,
      orderId: order.id,
      createdAt: new Date().toISOString(),
    })
  }
}

export async function createOrder(
  actor: Actor,
  data: { items: CartLine[]; paymentMethod: PaymentMethod; notes: string },
): Promise<Order> {
  return mutateDb((db) => {
    const active = db.orders.filter((o) => o.userId === actor.id && isActiveStatus(o.status)).length
    if (active >= MAX_ACTIVE_ORDERS_PER_USER) {
      throw new DomainError(`Puedes tener hasta ${MAX_ACTIVE_ORDERS_PER_USER} pedidos activos a la vez.`)
    }
    const { items, totalCents } = buildOrderItems(data.items, db.products)
    const now = new Date().toISOString()
    const created: Order = {
      id: newId(),
      number: db.nextOrderNumber++,
      userId: actor.id,
      customerName: actor.name,
      items,
      totalCents,
      status: 'pendiente',
      paymentMethod: data.paymentMethod,
      paymentStatus: 'pendiente',
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
      qrToken: newQrToken(),
    }
    for (const item of items) {
      const product = db.products.find((p) => p.id === item.productId)!
      product.stock -= item.quantity
      product.updatedAt = now
      db.movements.push({
        id: newId(),
        productId: product.id,
        delta: -item.quantity,
        reason: 'venta',
        note: `Pedido #${created.number}`,
        userId: actor.id,
        orderId: created.id,
        createdAt: now,
      })
    }
    db.orders.push(created)
    logEvent(db, actor, created, 'creado', { toStatus: 'pendiente' }, now)
    return created
  })
}

export async function changeOrderStatus(actor: Actor, orderId: string, status: OrderStatus): Promise<Order> {
  return mutateDb((db) => {
    const order = findVisibleOrder(db, actor, orderId)
    if (!canTransition(order.status, status, { role: actor.role, isOwner: order.userId === actor.id })) {
      throw new DomainError(
        order.status === 'entregado' || order.status === 'cancelado'
          ? `El pedido ya está ${order.status === 'entregado' ? 'entregado' : 'cancelado'}; no admite más cambios.`
          : 'Ese cambio de estado no está permitido.',
      )
    }
    if (status === 'entregado' && order.paymentStatus !== 'pagado') {
      throw new DomainError('Registra el pago antes de entregar el pedido.')
    }
    const now = new Date().toISOString()
    const from = order.status
    if (status === 'cancelado') {
      restoreStock(db, order, actor.id)
      if (order.paymentStatus === 'pagado') {
        order.paymentStatus = 'reembolsado'
        logEvent(db, actor, order, 'reembolso', { paymentId: order.paymentId, note: 'Pedido pagado y cancelado' }, now)
      }
    }
    if (status === 'entregado') order.deliveredBy = actor.id
    order.status = status
    order.updatedAt = now
    logEvent(db, actor, order, 'estado', { fromStatus: from, toStatus: status }, now)
    return order
  })
}

export interface ChargeInput {
  orderId: string
  method: ChargeMethod
  /** Required for the simulated card. */
  card?: DemoCardId
  /** Generated by the client per payment attempt; repeats return the same result. */
  idempotencyKey: string
  /** Amount the operator saw and confirmed; rejected if it no longer matches the server total. */
  expectedTotalCents?: number
}

export interface ChargeOutcome {
  payment: Payment
  order: Order
  /** True when the same request was received before and its stored result is returned. */
  replayed: boolean
}

/**
 * Registers a payment atomically. Runs inside the exclusive write queue, so two
 * concurrent requests for the same order are applied one after the other and the
 * second one sees the order already paid. The store also rejects any write that
 * would leave two successful payments for one order.
 */
export async function chargeOrder(actor: Actor, input: ChargeInput): Promise<ChargeOutcome> {
  if (!allowedChargeMethods(actor.role).includes(input.method)) {
    throw new DomainError('No tienes permiso para registrar este método de pago.')
  }
  if (input.method === 'tarjeta_simulada' && !input.card) throw new DomainError('Elige una tarjeta de prueba.')

  return mutateDb((db) => {
    const order = findVisibleOrder(db, actor, input.orderId)

    const previous = db.payments.find((p) => p.orderId === order.id && p.idempotencyKey === input.idempotencyKey)
    if (previous) {
      if (previous.userId !== actor.id) throw new DomainError('Solicitud de pago duplicada.')
      return { payment: previous, order, replayed: true }
    }

    const blocker = chargeBlocker(order)
    if (blocker) throw new DomainError(blocker)
    if (db.payments.some((p) => p.orderId === order.id && p.result === 'exitoso')) {
      throw new DomainError('Este pedido ya está pagado.')
    }

    const amountCents = computeOrderTotal(order.items)
    if (amountCents !== order.totalCents) throw new DomainError('El total del pedido no es consistente. Avisa a la administración.')
    if (input.expectedTotalCents !== undefined && input.expectedTotalCents !== amountCents) {
      throw new DomainError('El importe cambió. Revisa el total actualizado antes de cobrar.')
    }

    const authorization = input.method === 'tarjeta_simulada' ? simulateCardAuthorization(input.card!) : { approved: true as const }
    const now = new Date().toISOString()
    const payment: Payment = {
      id: newId(),
      reference: `${input.method === 'tarjeta_simulada' ? 'SIM' : 'EFE'}-${randomBytes(4).toString('hex').toUpperCase()}`,
      orderId: order.id,
      amountCents,
      method: input.method,
      result: authorization.approved ? 'exitoso' : 'fallido',
      failureReason: authorization.approved ? undefined : authorization.reason,
      simulated: input.method === 'tarjeta_simulada',
      channel: actor.role === 'cliente' ? 'comprador' : 'caja',
      idempotencyKey: input.idempotencyKey,
      userId: actor.id,
      createdAt: now,
    }
    db.payments.push(payment)

    if (payment.result === 'exitoso') {
      order.paymentStatus = 'pagado'
      order.paidMethod = payment.method
      order.paidAt = now
      order.paymentId = payment.id
      if (actor.role !== 'cliente') order.chargedBy = actor.id
      order.updatedAt = now
      logEvent(db, actor, order, 'pago_exitoso', { paymentId: payment.id, note: payment.reference }, now)
    } else {
      logEvent(db, actor, order, 'pago_fallido', { paymentId: payment.id, note: payment.failureReason ?? '' }, now)
    }
    return { payment, order, replayed: false }
  })
}

/** Resolves a scanned QR or typed folio. Staff only; each lookup is recorded in the history. */
export async function findOrderByCode(actor: Actor, code: string): Promise<Order> {
  if (!isStaff(actor.role)) throw new DomainError(NOT_FOUND)
  const parsed = parseOrderCode(code)
  if (parsed.kind === 'invalid') throw new DomainError('El código no es un QR de pedido de CafeTEC válido.')
  return mutateDb((db) => {
    const order =
      parsed.kind === 'token' ? db.orders.find((o) => o.qrToken === parsed.token) : db.orders.find((o) => o.number === parsed.number)
    if (!order) throw new DomainError(parsed.kind === 'token' ? 'Este QR no corresponde a ningún pedido.' : 'No existe un pedido con ese folio.')
    logEvent(db, actor, order, 'qr_consultado', { note: parsed.kind === 'token' ? 'QR' : 'Folio manual' })
    return order
  })
}

/** For the `/q/[token]` landing page: never reveals whether a token exists to unauthorized users. */
export async function findOrderIdByToken(actor: Actor, token: string): Promise<string | null> {
  const parsed = parseOrderCode(token)
  if (parsed.kind !== 'token') return null
  const db = await readDb()
  const order = db.orders.find((o) => o.qrToken === parsed.token)
  if (!order || (!isStaff(actor.role) && order.userId !== actor.id)) return null
  return order.id
}

// ---------- Read models (only the fields each screen needs) ----------

export interface OrderView {
  id: string
  number: number
  createdAt: string
  updatedAt: string
  customerLabel: string
  items: { productId: string; name: string; category?: Category; quantity: number; unitPriceCents: number; subtotalCents: number }[]
  totalCents: number
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
  paidMethod?: ChargeMethod
  paidAt?: string
  notes: string
  payments: PaymentView[]
  timeline: { id: string; type: OrderEventType; toStatus?: OrderStatus; note: string; createdAt: string; byStaff: boolean }[]
}

export interface PaymentView {
  id: string
  reference: string
  amountCents: number
  method: ChargeMethod
  result: Payment['result']
  failureReason?: string
  simulated: boolean
  channel: Payment['channel']
  createdAt: string
}

function toPaymentView(p: Payment): PaymentView {
  const { id, reference, amountCents, method, result, failureReason, simulated, channel, createdAt } = p
  return { id, reference, amountCents, method, result, failureReason, simulated, channel, createdAt }
}

function toOrderView(db: Database, order: Order, viewer: Actor): OrderView {
  const category = new Map(db.products.map((p) => [p.id, p.category]))
  return {
    id: order.id,
    number: order.number,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    // Buyers see their own name; the counter sees only first name + initial.
    customerLabel: viewer.id === order.userId ? order.customerName : maskCustomerName(order.customerName),
    items: order.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      category: category.get(i.productId),
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      subtotalCents: i.quantity * i.unitPriceCents,
    })),
    totalCents: computeOrderTotal(order.items),
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    paidMethod: order.paidMethod,
    paidAt: order.paidAt,
    notes: order.notes,
    payments: db.payments
      .filter((p) => p.orderId === order.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toPaymentView),
    timeline: db.orderEvents
      .filter((e) => e.orderId === order.id && e.type !== 'qr_consultado')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((e) => ({ id: e.id, type: e.type, toStatus: e.toStatus, note: e.type === 'pago_fallido' ? e.note : '', createdAt: e.createdAt, byStaff: e.role !== 'cliente' })),
  }
}

export async function getOrderView(actor: Actor, orderId: string): Promise<OrderView> {
  const db = await readDb()
  return toOrderView(db, findVisibleOrder(db, actor, orderId), actor)
}

/** QR token for the owner only; staff never needs it to render the order. */
export async function getOwnOrderQrToken(actor: Actor, orderId: string): Promise<string> {
  const db = await readDb()
  const order = db.orders.find((o) => o.id === orderId && o.userId === actor.id)
  if (!order) throw new DomainError(NOT_FOUND)
  return order.qrToken
}

export interface QueueOrder {
  id: string
  number: number
  createdAt: string
  customerLabel: string
  itemCount: number
  totalCents: number
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
}

function toQueueOrder(o: Order): QueueOrder {
  return {
    id: o.id,
    number: o.number,
    createdAt: o.createdAt,
    customerLabel: maskCustomerName(o.customerName),
    itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
    totalCents: o.totalCents,
    status: o.status,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
  }
}

export function cashierQueue(db: Database) {
  const active = db.orders.filter((o) => isActiveStatus(o.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return {
    awaitingPayment: active.filter((o) => o.paymentStatus === 'pendiente').map(toQueueOrder),
    awaitingDelivery: active.filter((o) => o.paymentStatus === 'pagado').map(toQueueOrder),
  }
}

export interface CashierOperation {
  id: string
  type: OrderEventType
  orderId: string
  orderNumber: number
  toStatus?: OrderStatus
  note: string
  createdAt: string
  payment?: PaymentView
}

/** Operations performed by one staff account, newest first. */
export function operationsBy(db: Database, userId: string, limit = 200): CashierOperation[] {
  const numbers = new Map(db.orders.map((o) => [o.id, o.number]))
  const payments = new Map(db.payments.map((p) => [p.id, p]))
  return db.orderEvents
    .filter((e) => e.userId === userId && e.type !== 'creado')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((e) => {
      const payment = e.paymentId ? payments.get(e.paymentId) : undefined
      return {
        id: e.id,
        type: e.type,
        orderId: e.orderId,
        orderNumber: numbers.get(e.orderId) ?? 0,
        toStatus: e.toStatus,
        note: e.note,
        createdAt: e.createdAt,
        payment: payment ? toPaymentView(payment) : undefined,
      }
    })
}

export function collectedBy(db: Database, userId: string, dayKey: (iso: string) => string, day: string) {
  const mine = db.payments.filter((p) => p.userId === userId && p.result === 'exitoso' && dayKey(p.createdAt) === day)
  const byMethod: Record<ChargeMethod, number> = { efectivo: 0, tarjeta_simulada: 0 }
  for (const p of mine) byMethod[p.method] += p.amountCents
  return { count: mine.length, totalCents: mine.reduce((s, p) => s + p.amountCents, 0), byMethod }
}
