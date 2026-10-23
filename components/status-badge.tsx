import { cn } from '@/lib/utils'
import { STATUS_LABELS, type OrderStatus, type PaymentStatus } from '@/lib/types'

const STATUS_STYLES: Record<OrderStatus, string> = {
  pendiente: 'bg-warning/25 text-warning-foreground',
  preparando: 'bg-accent/25 text-accent-foreground',
  listo: 'bg-success text-success-foreground',
  entregado: 'bg-muted text-muted-foreground',
  cancelado: 'bg-destructive/10 text-destructive',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </span>
  )
}

const PAYMENT_TEXT: Record<PaymentStatus, string> = {
  pendiente: 'Pago pendiente',
  pagado: 'Pagado',
  reembolsado: 'Reembolsar',
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium',
        status === 'pagado' ? 'border-success/40 text-success' : 'text-muted-foreground',
      )}
    >
      {PAYMENT_TEXT[status]}
    </span>
  )
}
