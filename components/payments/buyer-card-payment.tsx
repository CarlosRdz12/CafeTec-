'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { paySimulatedCardAction } from '@/app/actions/orders'
import type { DemoCardId } from '@/lib/domain/payments'
import { formatMoney } from '@/lib/format'
import { randomId } from '@/lib/utils'
import type { PaymentView } from '@/lib/server/order-service'
import { FormMessage } from '../form-controls'
import { DemoCardPicker } from './demo-card-picker'
import { PaymentReceipt } from './payment-receipt'
import { PrintButton } from '../print-button'

export function BuyerCardPayment({ orderId, orderNumber, totalCents }: { orderId: string; orderNumber: number; totalCents: number }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [card, setCard] = useState<DemoCardId>('aprobada')
  // One key per attempt: double clicks and retries of the same attempt cannot create a second payment.
  const [attemptKey, setAttemptKey] = useState(() => randomId())
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<PaymentView | null>(null)

  function pay() {
    if (pending) return
    setError(null)
    startTransition(async () => {
      const res = await paySimulatedCardAction({ orderId, card, idempotencyKey: attemptKey, expectedTotalCents: totalCents })
      if (!res.ok) {
        setError(res.error)
        router.refresh()
        return
      }
      setReceipt(res.data!)
      if (res.data!.result === 'fallido') setAttemptKey(randomId())
      router.refresh()
    })
  }

  if (receipt?.result === 'exitoso') {
    return (
      <div className="flex h-fit flex-col gap-3 rounded-2xl border bg-card p-5">
        <PaymentReceipt payment={receipt} orderNumber={orderNumber} />
        <div className="flex flex-wrap gap-2">
          <Link href={`/mis-pedidos/${orderId}`} className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-center font-medium text-primary-foreground hover:bg-primary/90">
            Ver pedido y QR
          </Link>
          <PrintButton label="Imprimir comprobante" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-fit flex-col gap-4 rounded-2xl border bg-card p-5 lg:sticky lg:top-24">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">Importe calculado por el servidor</span>
        <span className="font-serif text-2xl font-semibold tabular-nums text-primary">{formatMoney(totalCents)}</span>
      </div>
      <DemoCardPicker value={card} onChange={setCard} disabled={pending} />
      <p className="text-xs text-muted-foreground">
        No escribas datos de una tarjeta real: este formulario no los pide ni los acepta.
      </p>
      {receipt?.result === 'fallido' && (
        <>
          <PaymentReceipt payment={receipt} orderNumber={orderNumber} />
          <p className="text-sm text-muted-foreground">Tu pedido se conserva. Puedes reintentar o pagar en caja.</p>
        </>
      )}
      <FormMessage state={error ? { ok: false, error } : null} />
      <button
        type="button"
        onClick={pay}
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {pending && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />}
        {pending ? 'Procesando simulación…' : receipt ? 'Reintentar simulación' : 'Simular pago'}
      </button>
    </div>
  )
}
