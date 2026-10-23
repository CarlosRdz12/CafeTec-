import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { formatDateTime, formatMoney, formatOrderNumber } from '@/lib/format'
import type { QueueOrder } from '@/lib/server/order-service'
import { PAYMENT_LABELS } from '@/lib/types'
import { PaymentBadge, StatusBadge } from '../status-badge'

export function QueueList({ orders, empty }: { orders: QueueOrder[]; empty: string }) {
  if (orders.length === 0) {
    return <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{empty}</p>
  }
  return (
    <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/caja/pedido/${o.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60 focus-visible:bg-muted/60">
            <span className="font-sans text-lg font-semibold tabular-nums">{formatOrderNumber(o.number)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {o.customerLabel} · {o.itemCount} art. · {formatMoney(o.totalCents)}
              </span>
              <span className="block text-xs text-muted-foreground">
                {formatDateTime(o.createdAt)} · {PAYMENT_LABELS[o.paymentMethod]}
              </span>
            </span>
            <span className="hidden flex-col items-end gap-1 sm:flex">
              <StatusBadge status={o.status} />
              <PaymentBadge status={o.paymentStatus} />
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
