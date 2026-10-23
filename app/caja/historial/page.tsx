import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { OperationsTable } from '@/components/cashier/operations-table'
import { PageHeading } from '@/components/form-controls'
import { formatMoney } from '@/lib/format'
import { requirePageRole } from '@/lib/server/auth'
import { operationsBy } from '@/lib/server/order-service'
import { readDb } from '@/lib/server/store'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Historial de caja' }

const FILTERS = [
  { key: 'todo', label: 'Todo' },
  { key: 'cobros', label: 'Cobros' },
  { key: 'entregas', label: 'Estados y entregas' },
] as const

export default async function CashierHistoryPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const user = await requirePageRole(['cajero', 'admin'])
  const { tipo } = await searchParams
  const filter = FILTERS.find((f) => f.key === tipo) ?? FILTERS[0]
  const db = await readDb()
  // Each account only sees the operations it performed itself.
  const all = operationsBy(db, user.id)
  const operations = all.filter((op) =>
    filter.key === 'cobros' ? op.type === 'pago_exitoso' || op.type === 'pago_fallido' : filter.key === 'entregas' ? op.type === 'estado' : true,
  )
  const approved = all.filter((op) => op.type === 'pago_exitoso' && op.payment)
  const total = approved.reduce((s, op) => s + op.payment!.amountCents, 0)

  return (
    <AppShell>
      <Link href="/caja" className="-mb-4 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Caja
      </Link>
      <PageHeading
        title="Historial de operaciones"
        description={`${approved.length} cobro(s) aprobados por ${formatMoney(total)} registrados con tu cuenta (últimas 200 operaciones).`}
        actions={
          <nav aria-label="Filtrar" className="flex gap-1 rounded-lg border bg-card p-1 text-sm">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={`/caja/historial?tipo=${f.key}`}
                aria-current={f.key === filter.key ? 'page' : undefined}
                className={cn('rounded-md px-3 py-1', f.key === filter.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
              >
                {f.label}
              </Link>
            ))}
          </nav>
        }
      />
      <OperationsTable operations={operations} empty="No hay operaciones con este filtro." />
    </AppShell>
  )
}
