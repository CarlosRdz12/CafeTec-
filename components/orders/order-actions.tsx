'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markOrderPaidAction, updateOrderStatusAction } from '@/app/actions/orders'
import { nextStatuses } from '@/lib/domain/orders'
import type { OrderStatus, PaymentStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  preparando: 'Empezar a preparar',
  listo: 'Marcar como listo',
  entregado: 'Entregar',
}

export function OrderActions({
  orderId,
  status,
  paymentStatus,
  viewer,
}: {
  orderId: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  viewer: 'cliente' | 'staff'
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error ?? 'No se pudo completar la acción.')
      router.refresh()
    })
  }

  const cancel = () => run(() => updateOrderStatusAction(orderId, 'cancelado'), '¿Cancelar este pedido? El inventario se devolverá.')

  if (viewer === 'cliente') {
    if (status !== 'pendiente') return null
    return (
      <div className="flex flex-col gap-2">
        <button type="button" onClick={cancel} disabled={pending} className="rounded-lg border px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50">
          Cancelar pedido
        </button>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }

  const forward = nextStatuses(status).filter((s) => s !== 'cancelado')
  if (forward.length === 0 && paymentStatus !== 'pendiente') return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {paymentStatus === 'pendiente' && status !== 'cancelado' && (
          <button type="button" disabled={pending} onClick={() => run(() => markOrderPaidAction(orderId))} className="rounded-lg border border-success/50 px-3 py-1.5 text-sm font-medium text-success hover:bg-success/10 disabled:opacity-50">
            Registrar pago
          </button>
        )}
        {forward.map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending || (s === 'entregado' && paymentStatus !== 'pagado')}
            title={s === 'entregado' && paymentStatus !== 'pagado' ? 'Registra el pago primero' : undefined}
            onClick={() => run(() => updateOrderStatusAction(orderId, s))}
            className={cn('rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40')}
          >
            {NEXT_LABEL[s]}
          </button>
        ))}
        {nextStatuses(status).includes('cancelado') && (
          <button type="button" disabled={pending} onClick={cancel} className="ml-auto rounded-lg px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50">
            Cancelar
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
