import { Ban, Check } from 'lucide-react'
import { STATUS_LABELS, type OrderStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const STEPS: OrderStatus[] = ['pendiente', 'preparando', 'listo', 'entregado']

/** Visual stepper for the order workflow; cancelled orders show a single blocked state. */
export function OrderProgress({ status }: { status: OrderStatus }) {
  if (status === 'cancelado') {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
        <Ban className="size-4" aria-hidden="true" />
        Pedido cancelado. No admite más cambios.
      </p>
    )
  }
  const current = STEPS.indexOf(status)
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Avance del pedido">
      {STEPS.map((step, i) => {
        const done = i < current || status === 'entregado'
        const active = i === current && status !== 'entregado'
        return (
          <li key={step} className="flex flex-col items-center gap-1.5 text-center" aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'flex h-1.5 w-full rounded-full',
                done ? 'bg-success' : active ? 'bg-accent' : 'bg-muted',
              )}
              aria-hidden="true"
            />
            <span className={cn('flex items-center gap-1 text-[11px] leading-tight sm:text-xs', active ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
              {done && <Check className="size-3 text-success" aria-hidden="true" />}
              {STATUS_LABELS[step]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
