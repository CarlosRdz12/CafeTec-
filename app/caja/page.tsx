import type { Metadata } from 'next'
import Link from 'next/link'
import { History, ScanLine, UserRound } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { AutoRefresh } from '@/components/auto-refresh'
import { OperationsTable } from '@/components/cashier/operations-table'
import { OrderCodeForm } from '@/components/cashier/order-code-form'
import { QueueList } from '@/components/cashier/queue-list'
import { PageHeading } from '@/components/form-controls'
import { toDayKey } from '@/lib/domain/reports'
import { formatMoney } from '@/lib/format'
import { requirePageRole } from '@/lib/server/auth'
import { cashierQueue, collectedBy, operationsBy } from '@/lib/server/order-service'
import { readDb } from '@/lib/server/store'
import { ROLE_LABELS } from '@/lib/types'

export const metadata: Metadata = { title: 'Caja' }

export default async function CashierHomePage() {
  const user = await requirePageRole(['cajero', 'admin'])
  const db = await readDb()
  const { awaitingPayment, awaitingDelivery } = cashierQueue(db)
  const today = toDayKey(new Date().toISOString())
  const collected = collectedBy(db, user.id, toDayKey, today)
  const recent = operationsBy(db, user.id, 6)

  const stats = [
    { label: 'Cobros de hoy', value: String(collected.count) },
    { label: 'Total cobrado hoy', value: formatMoney(collected.totalCents) },
    { label: 'Efectivo', value: formatMoney(collected.byMethod.efectivo) },
    { label: 'Tarjeta (simulado)', value: formatMoney(collected.byMethod.tarjeta_simulada) },
  ]

  return (
    <AppShell>
      <AutoRefresh seconds={15} />
      <PageHeading
        title="Caja"
        description="Atiende pedidos escaneando su QR o buscando el folio. Se actualiza cada 15 segundos."
        actions={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1">
              <UserRound className="size-4 text-muted-foreground" aria-hidden="true" />
              {user.name} · {ROLE_LABELS[user.role]}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 font-medium text-success">
              <span className="size-2 rounded-full bg-success" aria-hidden="true" />
              Caja abierta
            </span>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <Link
          href="/caja/escanear"
          className="flex items-center justify-center gap-3 rounded-2xl bg-primary px-6 py-8 text-xl font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:ring-4 focus-visible:ring-ring/40"
        >
          <ScanLine className="size-8" aria-hidden="true" />
          Escanear pedido
        </Link>
        <div className="flex flex-col justify-center gap-2 rounded-2xl border bg-card p-5">
          <p className="text-sm font-medium">¿No funciona la cámara? Busca por folio</p>
          <OrderCodeForm compact />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{s.label}</dt>
            <dd className="mt-1 font-serif text-2xl font-semibold tabular-nums text-primary">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="por-cobrar" className="flex flex-col gap-3">
          <h2 id="por-cobrar" className="flex items-center justify-between text-xl font-semibold">
            Pendientes de pago
            <span className="rounded-full bg-warning/25 px-2.5 py-0.5 font-sans text-sm tabular-nums text-warning-foreground">{awaitingPayment.length}</span>
          </h2>
          <QueueList orders={awaitingPayment} empty="No hay pedidos esperando cobro." />
        </section>
        <section aria-labelledby="por-entregar" className="flex flex-col gap-3">
          <h2 id="por-entregar" className="flex items-center justify-between text-xl font-semibold">
            Pagados por entregar
            <span className="rounded-full bg-success/15 px-2.5 py-0.5 font-sans text-sm tabular-nums text-success">{awaitingDelivery.length}</span>
          </h2>
          <QueueList orders={awaitingDelivery} empty="No hay pedidos pagados esperando entrega." />
        </section>
      </div>

      <section aria-labelledby="ultimas" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="ultimas" className="text-xl font-semibold">Mis últimas operaciones</h2>
          <Link href="/caja/historial" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline">
            <History className="size-4" aria-hidden="true" />
            Historial de cobros
          </Link>
        </div>
        <OperationsTable operations={recent} empty="Aún no registras operaciones." />
      </section>
    </AppShell>
  )
}
