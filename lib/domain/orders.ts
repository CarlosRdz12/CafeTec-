import type { OrderItem, OrderStatus, Product, Role } from '@/lib/types'

export const MAX_QTY_PER_PRODUCT = 10
export const MAX_ITEMS_PER_ORDER = 30
export const MAX_ACTIVE_ORDERS_PER_USER = 3

export interface CartLine {
  productId: string
  quantity: number
}

export class DomainError extends Error {}

/**
 * Builds order lines from the client cart using server-side prices and stock.
 * Quantities are aggregated per product so duplicated lines cannot bypass limits.
 */
export function buildOrderItems(cart: CartLine[], products: Product[]): { items: OrderItem[]; totalCents: number } {
  if (cart.length === 0) throw new DomainError('El carrito está vacío.')

  const aggregated = new Map<string, number>()
  for (const line of cart) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new DomainError('Las cantidades deben ser números enteros positivos.')
    }
    aggregated.set(line.productId, (aggregated.get(line.productId) ?? 0) + line.quantity)
  }

  let totalUnits = 0
  const items: OrderItem[] = []
  for (const [productId, quantity] of aggregated) {
    const product = products.find((p) => p.id === productId)
    if (!product) throw new DomainError('Uno de los productos ya no existe.')
    if (!product.available) throw new DomainError(`"${product.name}" no está disponible por ahora.`)
    if (quantity > MAX_QTY_PER_PRODUCT) {
      throw new DomainError(`Máximo ${MAX_QTY_PER_PRODUCT} unidades de "${product.name}" por pedido.`)
    }
    if (quantity > product.stock) {
      throw new DomainError(`Solo quedan ${product.stock} unidades de "${product.name}".`)
    }
    totalUnits += quantity
    items.push({ productId, name: product.name, unitPriceCents: product.priceCents, quantity })
  }

  if (totalUnits > MAX_ITEMS_PER_ORDER) {
    throw new DomainError(`Un pedido puede tener como máximo ${MAX_ITEMS_PER_ORDER} artículos.`)
  }

  return { items, totalCents: computeOrderTotal(items) }
}

const STAFF_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pendiente: ['preparando', 'cancelado'],
  preparando: ['listo', 'cancelado'],
  listo: ['entregado', 'cancelado'],
  entregado: [],
  cancelado: [],
}

/** Cashiers move orders forward only: they cannot cancel (which would alter inventory). */
const CASHIER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pendiente: ['preparando'],
  preparando: ['listo'],
  listo: ['entregado'],
  entregado: [],
  cancelado: [],
}

export function canTransition(from: OrderStatus, to: OrderStatus, actor: { role: Role; isOwner: boolean }) {
  if (actor.role === 'cliente') {
    return actor.isOwner && from === 'pendiente' && to === 'cancelado'
  }
  if (actor.role === 'cajero') return CASHIER_TRANSITIONS[from].includes(to)
  return STAFF_TRANSITIONS[from].includes(to)
}

export function nextStatuses(from: OrderStatus, role: Role = 'personal'): OrderStatus[] {
  return role === 'cajero' ? CASHIER_TRANSITIONS[from] : STAFF_TRANSITIONS[from]
}

export function isActiveStatus(status: OrderStatus) {
  return status === 'pendiente' || status === 'preparando' || status === 'listo'
}

/** Total recomputed from the stored lines; the client-provided amount is never trusted. */
export function computeOrderTotal(items: OrderItem[]) {
  return items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0)
}

/** Shows only what the counter needs to hand over an order: first name and initial. */
export function maskCustomerName(name: string) {
  const [first = '', ...rest] = name.trim().split(/\s+/)
  const initial = rest[0]?.[0]
  return initial ? `${first} ${initial.toUpperCase()}.` : first
}
