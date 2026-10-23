import type { Metadata } from 'next'
import { AppShell } from '@/components/app-shell'
import { AutoRefresh } from '@/components/auto-refresh'
import { EmptyState, PageHeading } from '@/components/form-controls'
import { OrderCard } from '@/components/orders/order-card'
import { toDayKey } from '@/lib/domain/reports'
import { requirePageRole } from '@/lib/server/auth'
import { readDb } from '@/lib/server/store'
import { STATUS_LABELS, type OrderStatus } from '@/lib/types'

export const metadata: Metadata = { title: 'Pedidos' }

const COLUMNS: OrderStatus[] = ['pendiente', 'preparando', 'listo']

export default async function StaffOrdersPage() {
  await requirePageRole(['personal', 'admin'])
  const db = await readDb()
  const today = toDayKey(new Date().toISOString())
  const active = db.orders.filter((o) => COLUMNS.includes(o.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const closedToday = db.orders
    .filter((o) => !COLUMNS.includes(o.status) && toDayKey(o.updatedAt) === today)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <AppShell>
      <AutoRefresh seconds={10} />
      <PageHeading title="Pedidos en curso" description="Se actualiza cada 10 segundos. Registra el pago antes de entregar." />
      <div className="grid gap-6 lg:grid-cols-3">
        {COLUMNS.map((status) => {
          const orders = active.filter((o) => o.status === status)
          return (
            <section key={status} aria-labelledby={`col-${status}`} className="flex flex-col gap-3">
              <h2 id={`col-${status}`} className="flex items-center justify-between font-sans text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {STATUS_LABELS[status]}
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs tabular-nums text-secondary-foreground">{orders.length}</span>
              </h2>
              {orders.length === 0 ? (
                <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Sin pedidos</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {orders.map((o) => (
                    <li key={o.id}>
                      <OrderCard order={o} viewer="staff" />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
      <section aria-labelledby="cerrados" className="flex flex-col gap-3">
        <h2 id="cerrados" className="text-xl font-semibold">Cerrados hoy</h2>
        {closedToday.length === 0 ? (
          <EmptyState title="Nada por aquí" description="Los pedidos entregados o cancelados hoy aparecerán aquí." />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {closedToday.map((o) => (
              <li key={o.id}>
                <OrderCard order={o} viewer="staff" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  )
}
