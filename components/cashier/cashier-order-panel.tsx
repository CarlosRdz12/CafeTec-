'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Banknote, ChefHat, CreditCard, PackageCheck, ScanLine, ShieldCheck, Timer } from 'lucide-react'
import { cashierChargeAction, verifyPaymentAction } from '@/app/actions/cashier'
import { updateOrderStatusAction } from '@/app/actions/orders'
import { nextStatuses } from '@/lib/domain/orders'
import { chargeBlocker, type DemoCardId } from '@/lib/domain/payments'
import { formatDateTime, formatMoney, formatOrderNumber } from '@/lib/format'
import type { OrderView, PaymentView } from '@/lib/server/order-service'
import { CHARGE_LABELS, type ChargeMethod, type OrderStatus } from '@/lib/types'
import { cn, randomId } from '@/lib/utils'
import { FormMessage } from '../form-controls'
import { DemoCardPicker } from '../payments/demo-card-picker'
import { PaymentReceipt } from '../payments/payment-receipt'
import { SimulationBanner } from '../payments/simulation-banner'

const STATUS_ACTIONS: Partial<Record<OrderStatus, { label: string; icon: typeof ChefHat; confirm?: string }>> = {
  preparando: { label: 'Marcar en preparación', icon: ChefHat },
  listo: { label: 'Marcar como listo', icon: Timer },
  entregado: { label: 'Confirmar entrega', icon: PackageCheck, confirm: '¿Confirmas que entregaste el pedido al comprador?' },
}

type Feedback = { ok: boolean; error?: string; message?: string } | null

export function CashierOrderPanel({ order }: { order: OrderView }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [charging, setCharging] = useState(false)
  const [method, setMethod] = useState<ChargeMethod>('efectivo')
  const [card, setCard] = useState<DemoCardId>('aprobada')
  // New key per attempt so double clicks or network retries never charge twice.
  const [attemptKey, setAttemptKey] = useState(() => randomId())
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [receipt, setReceipt] = useState<PaymentView | null>(null)

  const blocker = chargeBlocker(order)
  const forward = nextStatuses(order.status, 'cajero')
  const closed = order.status === 'entregado' || order.status === 'cancelado'
  const label = formatOrderNumber(order.number)

  function run(task: () => Promise<void>) {
    if (pending) return
    setFeedback(null)
    startTransition(async () => {
      await task()
      router.refresh()
    })
  }

  function charge() {
    const what = method === 'efectivo' ? 'Registrar cobro en efectivo' : 'Simular pago con tarjeta'
    if (!window.confirm(`${what} por ${formatMoney(order.totalCents)} del pedido ${label}?`)) return
    run(async () => {
      const res = await cashierChargeAction({
        orderId: order.id,
        method,
        card: method === 'tarjeta_simulada' ? card : undefined,
        idempotencyKey: attemptKey,
        expectedTotalCents: order.totalCents,
      })
      if (!res.ok) return setFeedback(res)
      setReceipt(res.data!)
      if (res.data!.result === 'exitoso') {
        setCharging(false)
        setFeedback({ ok: true, message: 'Pago registrado. Ya puedes continuar con la entrega.' })
      } else {
        setAttemptKey(randomId())
        setFeedback({ ok: false, error: 'La simulación fue rechazada. El pedido sigue pendiente de pago; puedes reintentar.' })
      }
    })
  }

  function verify() {
    run(async () => {
      const res = await verifyPaymentAction(order.id)
      if (!res.ok) return setFeedback(res)
      const p = res.data!.payment
      setFeedback(
        p
          ? { ok: true, message: `Pago verificado en el sistema: ${p.reference} · ${CHARGE_LABELS[p.method]} · ${formatMoney(p.amountCents)} · ${formatDateTime(p.createdAt)}.` }
          : { ok: false, error: res.data!.paymentStatus === 'reembolsado' ? 'El pedido se canceló tras pagarse: reembolso pendiente.' : 'No hay ningún pago exitoso registrado para este pedido.' },
      )
    })
  }

  function move(status: OrderStatus) {
    const action = STATUS_ACTIONS[status]
    if (action?.confirm && !window.confirm(action.confirm)) return
    run(async () => {
      const res = await updateOrderStatusAction(order.id, status)
      setFeedback(res.ok ? { ok: true, message: `Pedido ${label} actualizado.` } : res)
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 lg:sticky lg:top-24">
      <h2 className="text-lg font-semibold">Acciones</h2>

      {closed && (
        <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm font-medium">
          {order.status === 'entregado' ? 'Pedido entregado: no admite más operaciones.' : 'Pedido cancelado: no admite cobros ni entregas.'}
        </p>
      )}

      {blocker === null && !charging && (
        <button
          type="button"
          onClick={() => {
            setReceipt(null)
            setFeedback(null)
            setCharging(true)
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Banknote className="size-5" aria-hidden="true" />
          Registrar pago
        </button>
      )}

      {blocker === null && charging && (
        <section aria-label="Registrar pago" className="flex flex-col gap-3 rounded-xl border-2 border-primary/30 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-muted-foreground">Importe (calculado por el servidor)</span>
            <span className="font-serif text-2xl font-semibold tabular-nums text-primary">{formatMoney(order.totalCents)}</span>
          </div>
          <fieldset className="grid grid-cols-2 gap-2" disabled={pending}>
            <legend className="mb-1 text-sm font-medium">Método de pago</legend>
            {(['efectivo', 'tarjeta_simulada'] as const).map((m) => (
              <label
                key={m}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium',
                  method === m ? 'border-primary bg-secondary' : 'hover:bg-muted',
                )}
              >
                <input type="radio" name="charge-method" checked={method === m} onChange={() => setMethod(m)} className="accent-primary" />
                {m === 'efectivo' ? <Banknote className="size-4" aria-hidden="true" /> : <CreditCard className="size-4" aria-hidden="true" />}
                {CHARGE_LABELS[m]}
              </label>
            ))}
          </fieldset>
          {method === 'tarjeta_simulada' && (
            <>
              <SimulationBanner compact />
              <DemoCardPicker value={card} onChange={setCard} disabled={pending} />
            </>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={charge}
              disabled={pending}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-success px-4 py-2.5 font-medium text-success-foreground hover:bg-success/90 disabled:opacity-60"
            >
              {pending && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />}
              {method === 'efectivo' ? 'Confirmar cobro' : 'Simular pago'}
            </button>
            <button type="button" onClick={() => setCharging(false)} disabled={pending} className="rounded-lg border px-3 py-2.5 text-sm hover:bg-muted disabled:opacity-50">
              Cancelar
            </button>
          </div>
        </section>
      )}

      {receipt && <PaymentReceipt payment={receipt} orderNumber={order.number} />}

      {!closed && forward.length > 0 && (
        <div className="flex flex-col gap-2">
          {forward.map((status) => {
            const action = STATUS_ACTIONS[status]!
            if (status === 'entregado' && order.paymentStatus !== 'pagado') {
              return (
                <p key={status} className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                  Registra el pago para poder confirmar la entrega.
                </p>
              )
            }
            return (
              <button
                key={status}
                type="button"
                onClick={() => move(status)}
                disabled={pending}
                className={cn(
                  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium disabled:opacity-60',
                  status === 'entregado' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border bg-card hover:bg-muted',
                )}
              >
                <action.icon className="size-4" aria-hidden="true" />
                {action.label}
              </button>
            )
          })}
        </div>
      )}

      {order.status !== 'cancelado' && (
        <button
          type="button"
          onClick={verify}
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-60"
        >
          <ShieldCheck className="size-4" aria-hidden="true" />
          Verificar pago
        </button>
      )}

      <FormMessage state={feedback} />

      <Link href="/caja/escanear" className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 font-medium text-secondary-foreground hover:bg-secondary/70">
        <ScanLine className="size-4" aria-hidden="true" />
        Volver al escáner
      </Link>
    </div>
  )
}
