import type { Metadata } from 'next'
import { AppShell } from '@/components/app-shell'
import { PageHeading } from '@/components/form-controls'
import { StockAdjustForm } from '@/components/inventory/stock-adjust-form'
import { formatDateTime } from '@/lib/format'
import { requirePageRole } from '@/lib/server/auth'
import { readDb } from '@/lib/server/store'
import { CATEGORY_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Inventario' }

const REASON_LABELS = { venta: 'Venta', cancelacion: 'Cancelación', ajuste: 'Ajuste', reabastecimiento: 'Reabastecimiento' }

export default async function InventoryPage() {
  await requirePageRole(['personal', 'admin'])
  const db = await readDb()
  const products = [...db.products].sort((a, b) => a.stock - a.lowStockThreshold - (b.stock - b.lowStockThreshold))
  const movements = [...db.movements].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 25)
  const userName = new Map(db.users.map((u) => [u.id, u.name]))
  const productName = new Map(db.products.map((p) => [p.id, p.name]))
  const lowCount = products.filter((p) => p.stock <= p.lowStockThreshold).length

  return (
    <AppShell>
      <PageHeading
        title="Inventario"
        description={lowCount > 0 ? `${lowCount} producto(s) con stock bajo.` : 'Todo el inventario está por encima del mínimo.'}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Producto</th>
                <th scope="col" className="px-4 py-3 font-medium">Categoría</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Stock</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Mínimo</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const low = p.stock <= p.lowStockThreshold
                return (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {p.name}
                      {!p.available && <span className="ml-2 text-xs text-muted-foreground">(no disponible)</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{CATEGORY_LABELS[p.category]}</td>
                    <td className={cn('px-4 py-3 text-right font-semibold tabular-nums', low && 'text-destructive')}>
                      {p.stock}
                      {low && <span className="sr-only"> (stock bajo)</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{p.lowStockThreshold}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <StockAdjustForm products={db.products.map((p) => ({ id: p.id, name: p.name, stock: p.stock }))} />
      </div>
      <section aria-labelledby="movimientos" className="flex flex-col gap-3">
        <h2 id="movimientos" className="text-xl font-semibold">Movimientos recientes</h2>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Fecha</th>
                <th scope="col" className="px-4 py-3 font-medium">Producto</th>
                <th scope="col" className="px-4 py-3 font-medium">Motivo</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Cambio</th>
                <th scope="col" className="px-4 py-3 font-medium">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Sin movimientos todavía.</td>
                </tr>
              )}
              {movements.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatDateTime(m.createdAt)}</td>
                  <td className="px-4 py-2.5">{productName.get(m.productId) ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    {REASON_LABELS[m.reason]}
                    {m.note && <span className="block text-xs text-muted-foreground">{m.note}</span>}
                  </td>
                  <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums', m.delta < 0 ? 'text-destructive' : 'text-success')}>
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{userName.get(m.userId) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  )
}
