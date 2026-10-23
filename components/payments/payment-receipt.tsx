import { CheckCircle2, CircleX } from 'lucide-react'
import { SIMULATION_NOTICE } from '@/lib/domain/payments'
import { formatDateTime, formatMoney, formatOrderNumber } from '@/lib/format'
import type { PaymentView } from '@/lib/server/order-service'
import { CHARGE_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Demo receipt for a payment attempt (successful or declined). */
export function PaymentReceipt({ payment, orderNumber, className }: { payment: PaymentView; orderNumber: number; className?: string }) {
  const ok = payment.result === 'exitoso'
  const rows: [string, string][] = [
    ['Folio del pedido', formatOrderNumber(orderNumber)],
    ['Importe', formatMoney(payment.amountCents)],
    ['Fecha', formatDateTime(payment.createdAt)],
    ['Método', CHARGE_LABELS[payment.method]],
    ['Referencia', payment.reference],
    ['Resultado', ok ? 'Aprobado' : `Rechazado${payment.failureReason ? ` · ${payment.failureReason}` : ''}`],
  ]
  return (
    <section
      aria-label="Comprobante de pago"
      className={cn('print-area flex flex-col gap-3 rounded-xl border-2 bg-card p-4', ok ? 'border-success/50' : 'border-destructive/40', className)}
    >
      <div className={cn('flex items-center gap-2 font-semibold', ok ? 'text-success' : 'text-destructive')}>
        {ok ? <CheckCircle2 className="size-5" aria-hidden="true" /> : <CircleX className="size-5" aria-hidden="true" />}
        {ok ? 'Pago registrado' : 'Pago rechazado'}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {payment.simulated && (
        <p className="rounded-md bg-warning/20 px-2 py-1 text-center text-[11px] font-bold tracking-wide text-warning-foreground">
          {SIMULATION_NOTICE} · Comprobante de demostración
        </p>
      )}
    </section>
  )
}
