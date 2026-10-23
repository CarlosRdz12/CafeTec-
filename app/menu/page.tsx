import type { Metadata } from 'next'
import { AppShell } from '@/components/app-shell'
import { PageHeading } from '@/components/form-controls'
import { MenuBrowser } from '@/components/menu/menu-browser'
import { getCurrentUser } from '@/lib/server/auth'
import { isOnlinePaymentEnabled, isSimulatedCardEnabled } from '@/lib/server/payments'
import { readDb } from '@/lib/server/store'

export const metadata: Metadata = { title: 'Menú' }

export default async function MenuPage() {
  const [user, db] = await Promise.all([getCurrentUser(), readDb()])
  const products = db.products
    .filter((p) => p.available)
    .map(({ id, name, description, category, priceCents, stock }) => ({ id, name, description, category, priceCents, stock }))

  return (
    <AppShell>
      <PageHeading title="Menú del día" description="Precios en pesos mexicanos. La disponibilidad se actualiza con cada pedido." />
      <MenuBrowser
        products={products}
        signedIn={Boolean(user)}
        canOrder={user?.role !== 'cajero'}
        onlinePaymentEnabled={isOnlinePaymentEnabled()}
        simulatedCardEnabled={isSimulatedCardEnabled()}
      />
    </AppShell>
  )
}
