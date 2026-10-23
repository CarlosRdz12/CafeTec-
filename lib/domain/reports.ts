import type { Order, PaymentMethod, Product } from '@/lib/types'

export interface SalesReport {
  orderCount: number
  revenueCents: number
  averageTicketCents: number
  cancelledCount: number
  byDay: { day: string; revenueCents: number; orders: number }[]
  topProducts: { productId: string; name: string; quantity: number; revenueCents: number }[]
  byPayment: Record<PaymentMethod, number>
}

const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' })

export function toDayKey(iso: string) {
  return dayKey.format(new Date(iso))
}

/** Revenue counts only delivered orders that were paid. */
export function buildSalesReport(orders: Order[], from: string, to: string): SalesReport {
  const inRange = orders.filter((o) => {
    const d = toDayKey(o.createdAt)
    return d >= from && d <= to
  })
  const sold = inRange.filter((o) => o.status === 'entregado' && o.paymentStatus === 'pagado')

  const byDayMap = new Map<string, { revenueCents: number; orders: number }>()
  const productMap = new Map<string, { name: string; quantity: number; revenueCents: number }>()
  const byPayment: Record<PaymentMethod, number> = { caja: 0, en_linea: 0, tarjeta_simulada: 0 }

  for (const order of sold) {
    const key = toDayKey(order.createdAt)
    const day = byDayMap.get(key) ?? { revenueCents: 0, orders: 0 }
    day.revenueCents += order.totalCents
    day.orders += 1
    byDayMap.set(key, day)
    byPayment[order.paymentMethod] += order.totalCents
    for (const item of order.items) {
      const p = productMap.get(item.productId) ?? { name: item.name, quantity: 0, revenueCents: 0 }
      p.quantity += item.quantity
      p.revenueCents += item.quantity * item.unitPriceCents
      productMap.set(item.productId, p)
    }
  }

  const revenueCents = sold.reduce((s, o) => s + o.totalCents, 0)
  return {
    orderCount: sold.length,
    revenueCents,
    averageTicketCents: sold.length ? Math.round(revenueCents / sold.length) : 0,
    cancelledCount: inRange.filter((o) => o.status === 'cancelado').length,
    byDay: [...byDayMap.entries()].map(([day, v]) => ({ day, ...v })).sort((a, b) => a.day.localeCompare(b.day)),
    topProducts: [...productMap.entries()]
      .map(([productId, v]) => ({ productId, ...v }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5),
    byPayment,
  }
}

export function lowStockProducts(products: Product[]) {
  return products.filter((p) => p.stock <= p.lowStockThreshold).sort((a, b) => a.stock - b.stock)
}
