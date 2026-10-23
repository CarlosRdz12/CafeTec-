'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { DomainError } from '@/lib/domain/orders'
import { DEMO_CARD_IDS } from '@/lib/domain/payments'
import { requireActionRole } from '@/lib/server/auth'
import { toActionError, type ActionResult } from '@/lib/server/action-result'
import { chargeOrder, findOrderByCode, getOrderView, type PaymentView } from '@/lib/server/order-service'
import { isSimulatedCardEnabled } from '@/lib/server/payments'
import { checkRateLimit } from '@/lib/server/rate-limit'
import { CHARGE_METHODS, type PaymentStatus } from '@/lib/types'

const CASHIER_ROLES = ['cajero', 'admin'] as const

/** Resolves a scanned QR (URL or token) or a typed folio into an order id. */
export async function resolveOrderCodeAction(code: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireActionRole([...CASHIER_ROLES])
    if (!checkRateLimit(`scan:${user.id}`, 120, 60_000)) {
      return { ok: false, error: 'Demasiadas lecturas seguidas. Espera un momento.' }
    }
    const text = z.string().max(300, 'El código es demasiado largo.').parse(code)
    const order = await findOrderByCode(user, text)
    return { ok: true, data: { id: order.id } }
  } catch (error) {
    return toActionError(error)
  }
}

const chargeSchema = z
  .object({
    orderId: z.string().uuid(),
    method: z.enum(CHARGE_METHODS, { message: 'Elige un método de pago.' }),
    card: z.enum(DEMO_CARD_IDS).optional(),
    idempotencyKey: z.string().uuid(),
    expectedTotalCents: z.number().int().nonnegative(),
  })
  .refine((d) => d.method !== 'tarjeta_simulada' || d.card, { message: 'Elige una tarjeta de prueba.' })

/** Registers a counter payment. The amount is always recomputed on the server. */
export async function cashierChargeAction(input: unknown): Promise<ActionResult<PaymentView>> {
  try {
    const user = await requireActionRole([...CASHIER_ROLES])
    const data = chargeSchema.parse(input)
    if (data.method === 'tarjeta_simulada' && !isSimulatedCardEnabled()) throw new DomainError('El pago simulado está desactivado.')
    const { payment } = await chargeOrder(user, data)
    revalidatePath('/', 'layout')
    const view = await getOrderView(user, data.orderId)
    return { ok: true, data: view.payments.find((p) => p.id === payment.id)! }
  } catch (error) {
    return toActionError(error)
  }
}

/** Re-reads the payment state from the database ("Verificar pago"). */
export async function verifyPaymentAction(
  orderId: unknown,
): Promise<ActionResult<{ paymentStatus: PaymentStatus; payment: PaymentView | null }>> {
  try {
    const user = await requireActionRole([...CASHIER_ROLES])
    const view = await getOrderView(user, z.string().uuid().parse(orderId))
    return {
      ok: true,
      data: { paymentStatus: view.paymentStatus, payment: view.payments.find((p) => p.result === 'exitoso') ?? null },
    }
  } catch (error) {
    return toActionError(error)
  }
}
