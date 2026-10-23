import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CreditCard, Download } from 'lucide-react'
import { z } from 'zod'
import { AppShell } from '@/components/app-shell'
import { AutoRefresh } from '@/components/auto-refresh'
import { PageHeading } from '@/components/form-controls'
import { OrderActions } from '@/components/orders/order-actions'
import { OrderItemsTable } from '@/components/orders/order-items-table'
import { OrderProgress } from '@/components/orders/order-progress'
import { OrderTimeline } from '@/components/orders/order-timeline'
import { PrintButton } from '@/components/print-button'
import { PaymentBadge, StatusBadge } from '@/components/status-badge'
import { DomainError } from '@/lib/domain/orders'
import { chargeBlocker } from '@/lib/domain/payments'
import { formatDateTime, formatMoney, formatOrderNumber } from '@/lib/format'
import { requirePageRole } from '@/lib/server/auth'
import { getOrderView, getOwnOrderQrToken } from '@/lib/server/order-service'
import { isSimulatedCardEnabled } from '@/lib/server/payments'
import { renderOrderQr } from '@/lib/server/qr'
import { CHARGE_LABELS, PAYMENT_LABELS } from '@/lib/types'

export const metadata: Metadata = { title: 'Detalle del pedido' }

export default async function MyOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole(['cliente', 'personal', 'admin'])
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()

  // Only the owner reaches this page; staff use the counter screens.
  const buyer = { ...user, role: 'cliente' as const }
  let order, token
  try {
    ;[order, token] = await Promise.all([getOrderView(buyer, id), getOwnOrderQrToken(buyer, id)])
  } catch (error) {
    if (error instanceof DomainError) notFound()
    throw error
  }
  const qr = await renderOrderQr(token)
  const canPay = isSimulatedCardEnabled() && chargeBlocker(order) === null
  const paid = order.payments.find((p) => p.result === 'exitoso')
  const lastFailed = !paid ? order.payments.find((p) => p.result === 'fallido') : undefined

  return (
    <AppShell>
      <AutoRefresh seconds={15} />
      <Link href="/mis-pedidos" className="no-print -mb-4 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Mis pedidos
      </Link>
      <PageHeading
        title={`Pedido ${formatOrderNumber(order.number)}`}
        description={`Creado el ${formatDateTime(order.createdAt)} · ${order.customerLabel}`}
        actions={
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge status={order.status} />
            <PaymentBadge status={order.paymentStatus} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <section aria-label="Avance" className="rounded-xl border bg-card p-4">
            <OrderProgress status={order.status} />
          </section>

          <section aria-labelledby="productos" className="flex flex-col gap-3">
            <h2 id="productos" className="text-xl font-semibold">Productos</h2>
            <OrderItemsTable items={order.items} totalCents={order.totalCents} />
            {order.notes && <p className="rounded-lg bg-muted px-3 py-2 text-sm">Nota: {order.notes}</p>}
          </section>

          <section aria-labelledby="pago" className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <h2 id="pago" className="text-xl font-semibold">Pago</h2>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Estado del pago</dt>
                <dd className="mt-0.5"><PaymentBadge status={order.paymentStatus} /></dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Forma de pago elegida</dt>
                <dd className="mt-0.5 font-medium">{PAYMENT_LABELS[order.paymentMethod]}</dd>
              </div>
              {paid && (
                <>
                  <div>
                    <dt className="text-muted-foreground">Pagado con</dt>
                    <dd className="mt-0.5 font-medium">{CHARGE_LABELS[paid.method]} · {formatDateTime(paid.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Referencia</dt>
                    <dd className="mt-0.5 font-mono font-medium">{paid.reference}{paid.simulated && ' (simulado)'}</dd>
                  </div>
                </>
              )}
              <div>
                <dt className="text-muted-foreground">Total</dt>
                <dd className="mt-0.5 font-semibold tabular-nums">{formatMoney(order.totalCents)}</dd>
              </div>
            </dl>
            {lastFailed && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Último intento rechazado ({lastFailed.failureReason ?? 'sin motivo'}). El pedido sigue pendiente de pago; puedes reintentar o pagar en caja.
              </p>
            )}
            {order.paymentStatus === 'reembolsado' && (
              <p className="rounded-lg bg-warning/20 px-3 py-2 text-sm text-warning-foreground">
                El pedido se canceló después de pagarse. Acude a caja para el reembolso.
              </p>
            )}
            {canPay && (
              <Link
                href={`/mis-pedidos/${order.id}/pagar`}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:bg-primary/90 sm:w-fit"
              >
                <CreditCard className="size-4" aria-hidden="true" />
                Pagar con tarjeta (simulado)
              </Link>
            )}
            {order.paymentStatus === 'pendiente' && order.status !== 'cancelado' && (
              <p className="text-xs text-muted-foreground">También puedes pagar en caja al recoger mostrando tu QR.</p>
            )}
            <div className="no-print">
              <OrderActions orderId={order.id} status={order.status} paymentStatus={order.paymentStatus} viewer="cliente" />
            </div>
          </section>

          <section aria-labelledby="historial" className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <h2 id="historial" className="text-xl font-semibold">Historial del pedido</h2>
            <OrderTimeline events={order.timeline} />
          </section>
        </div>

        <aside aria-labelledby="qr-title" className="print-area flex h-fit flex-col items-center gap-3 rounded-2xl border bg-card p-5 text-center lg:sticky lg:top-24">
          <h2 id="qr-title" className="text-lg font-semibold">QR del pedido</h2>
          <p className="font-serif text-3xl font-semibold tabular-nums text-primary">{formatOrderNumber(order.number)}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.svgDataUrl} alt={`Código QR del pedido ${formatOrderNumber(order.number)}`} className="aspect-square w-full max-w-64 rounded-lg border bg-white p-2" />
          <p className="text-sm text-muted-foreground">
            {order.status === 'entregado' || order.status === 'cancelado'
              ? 'Este pedido ya está cerrado. El QR se conserva como referencia.'
              : 'Muestra este código en caja para cobrar o recoger tu pedido.'}
          </p>
          <p className="text-xs text-muted-foreground">
            El QR solo identifica el pedido: no es un comprobante de pago ni contiene tus datos.
          </p>
          <div className="no-print flex w-full flex-wrap justify-center gap-2">
            <a
              href={qr.pngDataUrl}
              download={`cafetec-pedido-${String(order.number).padStart(4, '0')}.png`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Download className="size-4" aria-hidden="true" />
              Descargar
            </a>
            <PrintButton />
          </div>
        </aside>
      </div>
    </AppShell>
  )
}
