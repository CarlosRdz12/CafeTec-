import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { z } from 'zod'
import { AppShell } from '@/components/app-shell'
import { PageHeading } from '@/components/form-controls'
import { OrderItemsTable } from '@/components/orders/order-items-table'
import { BuyerCardPayment } from '@/components/payments/buyer-card-payment'
import { PaymentReceipt } from '@/components/payments/payment-receipt'
import { PrintButton } from '@/components/print-button'
import { SimulationBanner } from '@/components/payments/simulation-banner'
import { DomainError } from '@/lib/domain/orders'
import { chargeBlocker } from '@/lib/domain/payments'
import { formatOrderNumber } from '@/lib/format'
import { requirePageRole } from '@/lib/server/auth'
import { getOrderView } from '@/lib/server/order-service'
import { isSimulatedCardEnabled } from '@/lib/server/payments'

export const metadata: Metadata = { title: 'Pagar con tarjeta (simulado)' }

export default async function PayOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole(['cliente', 'personal', 'admin'])
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()

  let order
  try {
    order = await getOrderView({ ...user, role: 'cliente' }, id)
  } catch (error) {
    if (error instanceof DomainError) notFound()
    throw error
  }
  const blocker = isSimulatedCardEnabled() ? chargeBlocker(order) : 'El pago simulado está desactivado.'
  const paid = order.payments.find((p) => p.result === 'exitoso')

  return (
    <AppShell>
      <Link href={`/mis-pedidos/${order.id}`} className="no-print -mb-4 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver al pedido
      </Link>
      <PageHeading title={`Pagar pedido ${formatOrderNumber(order.number)}`} description="Confirma el importe y simula el pago con una tarjeta de prueba." />
      <SimulationBanner />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section aria-labelledby="resumen" className="flex flex-col gap-3">
          <h2 id="resumen" className="text-xl font-semibold">Resumen</h2>
          <OrderItemsTable items={order.items} totalCents={order.totalCents} />
        </section>
        {blocker ? (
          <div className="flex h-fit flex-col gap-3 rounded-2xl border bg-card p-5">
            <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">{blocker}</p>
            {paid && <PaymentReceipt payment={paid} orderNumber={order.number} />}
            <div className="flex flex-wrap gap-2">
              <Link href={`/mis-pedidos/${order.id}`} className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-center font-medium text-primary-foreground hover:bg-primary/90">
                Ver pedido y QR
              </Link>
              {paid && <PrintButton label="Imprimir comprobante" />}
            </div>
          </div>
        ) : (
          <BuyerCardPayment orderId={order.id} orderNumber={order.number} totalCents={order.totalCents} />
        )}
      </div>
    </AppShell>
  )
}
