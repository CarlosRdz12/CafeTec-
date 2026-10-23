import { formatDateTime } from '@/lib/format'
import type { OrderView } from '@/lib/server/order-service'
import { EVENT_LABELS, STATUS_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'

export function OrderTimeline({ events }: { events: OrderView['timeline'] }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>
  return (
    <ol className="flex flex-col gap-3 border-l pl-4">
      {events.map((e) => (
        <li key={e.id} className="relative text-sm">
          <span
            className={cn(
              'absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-card',
              e.type === 'pago_fallido' || e.toStatus === 'cancelado' ? 'bg-destructive' : e.type === 'pago_exitoso' ? 'bg-success' : 'bg-accent',
            )}
            aria-hidden="true"
          />
          <p className="font-medium">
            {e.type === 'estado' && e.toStatus ? STATUS_LABELS[e.toStatus] : EVENT_LABELS[e.type]}
            {e.byStaff && <span className="font-normal text-muted-foreground"> · por caja</span>}
          </p>
          {e.note && <p className="text-xs text-destructive">{e.note}</p>}
          <p className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</p>
        </li>
      ))}
    </ol>
  )
}
