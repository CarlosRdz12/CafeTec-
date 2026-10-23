import type { Metadata } from 'next'
import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { PageHeading } from '@/components/form-controls'
import { SalesChart } from '@/components/reports/sales-chart'
import { buildSalesReport, lowStockProducts, toDayKey } from '@/lib/domain/reports'
import { formatMoney } from '@/lib/format'
import { requirePageRole } from '@/lib/server/auth'
import { readDb } from '@/lib/server/store'
import { PAYMENT_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Reportes' }

const RANGES = [
  { key: 'hoy', label: 'Hoy', days: 1 },
  { key: '7d', label: '7 días', days: 7 },
  { key: '30d', label: '30 días', days: 30 },
] as const

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ rango?: string }> }) {
  await requirePageRole(['admin'])
  const { rango } = await searchParams
  const range = RANGES.find((r) => r.key === rango) ?? RANGES[1]
  const db = await readDb()

  const to = toDayKey(new Date().toISOString())
  const from = toDayKey(new Date(Date.now() - (range.days - 1) * 86_400_000).toISOString())
  const report = buildSalesReport(db.orders, from, to)
  const lowStock = lowStockProducts(db.products)

  const days = Array.from({ length: range.days }, (_, i) => toDayKey(new Date(Date.now() - (range.days - 1 - i) * 86_400_000).toISOString()))
  const chartData = days.map((day) => ({ day: day.slice(5), ventas: (report.byDay.find((d) => d.day === day)?.revenueCents ?? 0) / 100 }))

  const stats = [
    { label: 'Ventas', value: formatMoney(report.revenueCents) },
    { label: 'Pedidos entregados', value: String(report.orderCount) },
    { label: 'Ticket promedio', value: formatMoney(report.averageTicketCents) },
    { label: 'Cancelados', value: String(report.cancelledCount) },
  ]

  return (
    <AppShell>
      <PageHeading
        title="Reportes de ventas"
        description="Solo cuentan pedidos entregados y pagados."
        actions={
          <nav aria-label="Rango" className="flex gap-1 rounded-lg border bg-card p-1 text-sm">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/admin?rango=${r.key}`}
                aria-current={r.key === range.key ? 'page' : undefined}
                className={cn('rounded-md px-3 py-1', r.key === range.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
              >
                {r.label}
              </Link>
            ))}
          </nav>
        }
      />
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{s.label}</dt>
            <dd className="mt-1 font-serif text-2xl font-semibold tabular-nums text-primary">{s.value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section aria-labelledby="ventas-dia" className="rounded-xl border bg-card p-5">
          <h2 id="ventas-dia" className="mb-4 text-lg font-semibold">Ventas por día</h2>
          <SalesChart data={chartData} />
        </section>
        <section aria-labelledby="top" className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <h2 id="top" className="text-lg font-semibold">Más vendidos</h2>
          {report.topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay ventas en este periodo.</p>
          ) : (
            <ol className="flex flex-col gap-2 text-sm">
              {report.topProducts.map((p, i) => (
                <li key={p.productId} className="flex justify-between gap-2">
                  <span>{i + 1}. {p.name}</span>
                  <span className="tabular-nums text-muted-foreground">{p.quantity} · {formatMoney(p.revenueCents)}</span>
                </li>
              ))}
            </ol>
          )}
          <h3 className="mt-2 font-sans text-sm font-semibold">Por forma de pago</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {(Object.keys(report.byPayment) as (keyof typeof report.byPayment)[]).map((m) => (
              <li key={m} className="flex justify-between">
                <span>{PAYMENT_LABELS[m]}</span>
                <span className="tabular-nums">{formatMoney(report.byPayment[m])}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section aria-labelledby="stock-bajo" className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="stock-bajo" className="text-lg font-semibold">Stock bajo</h2>
          <Link href="/personal/inventario" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Ir a inventario</Link>
        </div>
        {lowStock.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ningún producto está por debajo del mínimo.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {lowStock.map((p) => (
              <li key={p.id} className="rounded-full bg-destructive/10 px-3 py-1 text-sm text-destructive">
                {p.name}: <span className="font-semibold tabular-nums">{p.stock}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  )
}
