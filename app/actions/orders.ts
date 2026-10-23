'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { DomainError } from '@/lib/domain/orders'
import { DEMO_CARD_IDS } from '@/lib/domain/payments'
import { requireActionRole } from '@/lib/server/auth'
import { toActionError, type ActionResult } from '@/lib/server/action-result'
import { changeOrderStatus, chargeOrder, createOrder, getOrderView, type PaymentView } from '@/lib/server/order-service'
import { checkRateLimit } from '@/lib/server/rate-limit'
import { isOnlinePaymentEnabled, isSimulatedCardEnabled } from '@/lib/server/payments'
import { ORDER_STATUSES, PAYMENT_METHODS } from '@/lib/types'

const placeOrderSchema = z.object({
  items: z
    .array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(100) }))
    .min(1, 'El carrito está vacío.')
    .max(50),
  paymentMethod: z.enum(PAYMENT_METHODS),
  notes: z.string().trim().max(200, 'Las notas no pueden superar 200 caracteres.').default(''),
})

export async function placeOrderAction(input: unknown): Promise<ActionResult<{ id: string; number: number }>> {
  try {
    const user = await requireActionRole(['cliente', 'personal', 'admin'])
    if (!checkRateLimit(`order:${user.id}`, 10, 10 * 60_000)) {
      return { ok: false, error: 'Has hecho demasiados pedidos seguidos. Espera unos minutos.' }
    }
    const data = placeOrderSchema.parse(input)
    if (data.paymentMethod === 'en_linea' && !isOnlinePaymentEnabled()) {
      throw new DomainError('El pago en línea aún no está habilitado. Elige pago en caja.')
    }
    if (data.paymentMethod === 'tarjeta_simulada' && !isSimulatedCardEnabled()) {
      throw new DomainError('El pago simulado está desactivado. Elige pago en caja.')
    }

    const order = await createOrder(user, data)

    revalidatePath('/', 'layout')
    return { ok: true, data: { id: order.id, number: order.number } }
  } catch (error) {
    return toActionError(error)
  }
}

const statusSchema = z.object({ orderId: z.string().uuid(), status: z.enum(ORDER_STATUSES) })

export async function updateOrderStatusAction(orderId: string, status: string): Promise<ActionResult> {
  try {
    const user = await requireActionRole(['cliente', 'personal', 'cajero', 'admin'])
    const data = statusSchema.parse({ orderId, status })
    await changeOrderStatus(user, data.orderId, data.status)
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    return toActionError(error)
  }
}

/** Counter payment from the staff board; recorded as a cash payment. */
export async function markOrderPaidAction(orderId: string): Promise<ActionResult> {
  try {
    const user = await requireActionRole(['personal', 'admin'])
    const id = z.string().uuid().parse(orderId)
    await chargeOrder(user, { orderId: id, method: 'efectivo', idempotencyKey: `tablero:${id}` })
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    return toActionError(error)
  }
}

const simulatedPaymentSchema = z.object({
  orderId: z.string().uuid(),
  card: z.enum(DEMO_CARD_IDS, { message: 'Elige una tarjeta de prueba.' }),
  idempotencyKey: z.string().uuid(),
  expectedTotalCents: z.number().int().nonnegative(),
})

/** Buyer pays their own order with the demo card. No card data is received or stored. */
export async function paySimulatedCardAction(input: unknown): Promise<ActionResult<PaymentView>> {
  try {
    const user = await requireActionRole(['cliente', 'personal', 'admin'])
    if (!isSimulatedCardEnabled()) throw new DomainError('El pago simulado está desactivado.')
    if (!checkRateLimit(`pay:${user.id}`, 20, 10 * 60_000)) {
      return { ok: false, error: 'Demasiados intentos de pago. Espera unos minutos.' }
    }
    const data = simulatedPaymentSchema.parse(input)
    // Acting as buyer: ownership is enforced and only the simulated card is allowed, whatever the account role.
    const { payment } = await chargeOrder({ ...user, role: 'cliente' }, { ...data, method: 'tarjeta_simulada' })
    revalidatePath('/', 'layout')
    return { ok: true, data: (await getOrderView(user, data.orderId)).payments.find((p) => p.id === payment.id)! }
  } catch (error) {
    return toActionError(error)
  }
}
