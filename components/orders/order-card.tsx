import Link from 'next/link'
import { QrCode } from 'lucide-react'
import { formatDateTime, formatMoney, formatOrderNumber } from '@/lib/format'
import { PAYMENT_LABELS, type Order } from '@/lib/types'
import { PaymentBadge, StatusBadge } from '../status-badge'
import { OrderActions } from './order-actions'

export function OrderCard({ order, viewer, href }: { order: Order; viewer: 'cliente' | 'staff'; href?: string }) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-sans text-lg font-semibold tabular-nums">{formatOrderNumber(order.number)}</h3>
          <p className="text-xs text-muted-foreground">
            {viewer === 'staff' && <span className="font-medium text-foreground">{order.customerName} · </span>}
            {formatDateTime(order.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge status={order.status} />
          <PaymentBadge status={order.paymentStatus} />
        </div>
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {order.items.map((i) => (
          <li key={i.productId} className="flex justify-between gap-2">
            <span>
              <span className="tabular-nums">{i.quantity}×</span> {i.name}
            </span>
            <span className="tabular-nums text-muted-foreground">{formatMoney(i.quantity * i.unitPriceCents)}</span>
          </li>
        ))}
      </ul>
      {order.notes && <p className="rounded-lg bg-muted px-3 py-2 text-sm">Nota: {order.notes}</p>}
      <div className="mt-auto flex items-center justify-between border-t pt-3 text-sm">
        <span className="text-muted-foreground">{PAYMENT_LABELS[order.paymentMethod]}</span>
        <span className="font-semibold tabular-nums">{formatMoney(order.totalCents)}</span>
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/70"
        >
          <QrCode className="size-4" aria-hidden="true" />
          {viewer === 'cliente' && order.paymentStatus === 'pendiente' && order.status !== 'cancelado' ? 'Ver detalle, QR y pago' : 'Ver detalle y QR'}
        </Link>
      )}
      <OrderActions orderId={order.id} status={order.status} paymentStatus={order.paymentStatus} viewer={viewer} />
    </article>
  )
}
