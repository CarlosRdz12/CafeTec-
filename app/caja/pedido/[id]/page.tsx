import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { z } from 'zod'
import { AppShell } from '@/components/app-shell'
import { AutoRefresh } from '@/components/auto-refresh'
import { CashierOrderPanel } from '@/components/cashier/cashier-order-panel'
import { PageHeading } from '@/components/form-controls'
import { OrderItemsTable } from '@/components/orders/order-items-table'
import { OrderProgress } from '@/components/orders/order-progress'
import { PaymentBadge, StatusBadge } from '@/components/status-badge'
import { DomainError } from '@/lib/domain/orders'
import { formatDateTime, formatOrderNumber } from '@/lib/format'
import { requirePageRole } from '@/lib/server/auth'
import { getOrderView } from '@/lib/server/order-service'
import { CHARGE_LABELS, PAYMENT_LABELS } from '@/lib/types'

export const metadata: Metadata = { title: 'Pedido en caja' }

export default async function CashierOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole(['cajero', 'admin'])
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()
  let order
  try {
    order = await getOrderView(user, id)
  } catch (error) {
    if (error instanceof DomainError) notFound()
    throw error
  }
  const paid = order.payments.find((p) => p.result === 'exitoso')

  return (
    <AppShell>
      <AutoRefresh seconds={20} />
      <Link href="/caja" className="-mb-4 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Caja
      </Link>
      <PageHeading
        title={`Pedido ${formatOrderNumber(order.number)}`}
        description={`${order.customerLabel} · creado el ${formatDateTime(order.createdAt)}`}
        actions={
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge status={order.status} />
            <PaymentBadge status={order.paymentStatus} />
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-5">
          <section aria-label="Avance" className="rounded-xl border bg-card p-4">
            <OrderProgress status={order.status} />
          </section>
          <OrderItemsTable items={order.items} totalCents={order.totalCents} />
          {order.notes && <p className="rounded-lg bg-muted px-3 py-2 text-sm">Nota del comprador: {order.notes}</p>}
          <dl className="grid gap-4 rounded-xl border bg-card p-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Forma de pago elegida</dt>
              <dd className="mt-0.5 font-medium">{PAYMENT_LABELS[order.paymentMethod]}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Pagado con</dt>
              <dd className="mt-0.5 font-medium">{paid ? `${CHARGE_LABELS[paid.method]}${paid.channel === 'comprador' ? ' (en línea)' : ''}` : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Referencia</dt>
              <dd className="mt-0.5 font-mono font-medium">{paid ? paid.reference : '—'}</dd>
            </div>
          </dl>
          {order.payments.some((p) => p.result === 'fallido') && (
            <p className="text-xs text-muted-foreground">
              Intentos rechazados: {order.payments.filter((p) => p.result === 'fallido').length}. Solo cuenta el pago aprobado.
            </p>
          )}
        </div>
        <CashierOrderPanel order={order} />
      </div>
    </AppShell>
  )
}
