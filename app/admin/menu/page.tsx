import type { Metadata } from 'next'
import { AppShell } from '@/components/app-shell'
import { PageHeading } from '@/components/form-controls'
import { ProductManager } from '@/components/admin/product-manager'
import { requirePageRole } from '@/lib/server/auth'
import { readDb } from '@/lib/server/store'

export const metadata: Metadata = { title: 'Productos' }

export default async function AdminMenuPage() {
  await requirePageRole(['admin'])
  const db = await readDb()
  const products = [...db.products].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
  return (
    <AppShell>
      <PageHeading title="Productos del menú" description="Crea, edita o desactiva productos. Los desactivados no aparecen en el menú." />
      <ProductManager products={products} />
    </AppShell>
  )
}
