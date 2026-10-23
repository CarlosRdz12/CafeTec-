import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { EmptyState } from '@/components/form-controls'
import { getCurrentUser } from '@/lib/server/auth'
import { findOrderIdByToken } from '@/lib/server/order-service'

export const metadata: Metadata = { title: 'Código de pedido', robots: { index: false } }

/**
 * Target of the URL encoded in every order QR. The token reveals nothing by itself:
 * the order is looked up on the server and shown only to its owner or to staff.
 */
export default async function QrLandingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const orderId = await findOrderIdByToken(user, token)
  if (orderId) {
    if (user.role === 'cajero' || user.role === 'admin') redirect(`/caja/pedido/${orderId}`)
    if (user.role === 'personal') redirect('/personal')
    redirect(`/mis-pedidos/${orderId}`)
  }

  return (
    <AppShell>
      <EmptyState title="Código no disponible" description="Este código no corresponde a ningún pedido que puedas consultar con tu cuenta.">
        <Link href="/" className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Ir al inicio
        </Link>
      </EmptyState>
    </AppShell>
  )
}
