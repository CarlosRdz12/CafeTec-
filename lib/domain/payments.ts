import type { ChargeMethod, Order, Role } from '@/lib/types'

export const SIMULATION_NOTICE = 'SIMULACIÓN — NO SE REALIZA NINGÚN COBRO REAL'

/**
 * Demo cards for the simulated payment. They are scenarios, not card numbers:
 * nothing here resembles a usable card and no card data is ever requested.
 */
export const DEMO_CARDS = [
  { id: 'aprobada', label: 'Tarjeta demo · Aprobada', masked: 'DEMO •••• APROBADA', holder: 'TITULAR DE PRUEBA' },
  {
    id: 'rechazada',
    label: 'Tarjeta demo · Rechazada',
    masked: 'DEMO •••• RECHAZADA',
    holder: 'TITULAR DE PRUEBA',
    failureReason: 'Fondos insuficientes (simulado)',
  },
] as const

export type DemoCardId = (typeof DEMO_CARDS)[number]['id']
export const DEMO_CARD_IDS = DEMO_CARDS.map((c) => c.id) as [DemoCardId, ...DemoCardId[]]

export function simulateCardAuthorization(card: DemoCardId): { approved: true } | { approved: false; reason: string } {
  const demo = DEMO_CARDS.find((c) => c.id === card)
  if (!demo) return { approved: false, reason: 'Tarjeta de prueba desconocida' }
  return 'failureReason' in demo ? { approved: false, reason: demo.failureReason } : { approved: true }
}

/** Which charge methods each role may register. Buyers can only use the simulated card online. */
export function allowedChargeMethods(role: Role): ChargeMethod[] {
  if (role === 'cliente') return ['tarjeta_simulada']
  if (role === 'personal') return ['efectivo']
  return ['efectivo', 'tarjeta_simulada']
}

/** Returns why an order cannot be charged, or null when a charge is allowed. */
export function chargeBlocker(order: Pick<Order, 'status' | 'paymentStatus'>): string | null {
  if (order.status === 'cancelado') return 'No se puede cobrar un pedido cancelado.'
  if (order.paymentStatus === 'pagado') return 'Este pedido ya está pagado.'
  if (order.paymentStatus === 'reembolsado') return 'Este pedido tiene un reembolso pendiente.'
  if (order.status === 'entregado') return 'El pedido ya fue entregado.'
  return null
}
