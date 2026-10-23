import type { Metadata } from 'next'
import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { EmptyState, PageHeading } from '@/components/form-controls'
import { OrderCard } from '@/components/orders/order-card'
import { AutoRefresh } from '@/components/auto-refresh'
import { isActiveStatus } from '@/lib/domain/orders'
import { requirePageRole } from '@/lib/server/auth'
import { readDb } from '@/lib/server/store'

export const metadata: Metadata = { title: 'Mis pedidos' }

export default async function MyOrdersPage() {
  const user = await requirePageRole(['cliente', 'personal', 'admin'])
  const db = await readDb()
  const orders = db.orders.filter((o) => o.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const active = orders.filter((o) => isActiveStatus(o.status))
  const history = orders.filter((o) => !isActiveStatus(o.status))

  return (
    <AppShell>
      <AutoRefresh seconds={15} />
      <PageHeading
        title="Mis pedidos"
        description="El estado se actualiza automáticamente. Abre un pedido para ver su QR y pagarlo."
        actions={
          <Link href="/menu" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Nuevo pedido
          </Link>
        }
      />
      {orders.length === 0 ? (
        <EmptyState title="Aún no tienes pedidos" description="Cuando hagas tu primer pedido aparecerá aquí.">
          <Link href="/menu" className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Ver el menú
          </Link>
        </EmptyState>
      ) : (
        <>
          <section aria-labelledby="activos" className="flex flex-col gap-3">
            <h2 id="activos" className="text-xl font-semibold">En curso</h2>
            {active.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No tienes pedidos en curso.</p>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {active.map((o) => (
                  <li key={o.id}>
                    <OrderCard order={o} viewer="cliente" href={`/mis-pedidos/${o.id}`} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          {history.length > 0 && (
            <section aria-labelledby="historial" className="flex flex-col gap-3">
              <h2 id="historial" className="text-xl font-semibold">Historial</h2>
              <ul className="grid gap-4 md:grid-cols-2">
                {history.map((o) => (
                  <li key={o.id}>
                    <OrderCard order={o} viewer="cliente" href={`/mis-pedidos/${o.id}`} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </AppShell>
  )
}
