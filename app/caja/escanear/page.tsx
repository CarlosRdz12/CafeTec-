import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { OrderCodeForm } from '@/components/cashier/order-code-form'
import { QrScanner } from '@/components/cashier/qr-scanner'
import { PageHeading } from '@/components/form-controls'
import { requirePageRole } from '@/lib/server/auth'

export const metadata: Metadata = { title: 'Escanear pedido' }

export default async function ScanPage() {
  await requirePageRole(['cajero', 'admin'])
  return (
    <AppShell>
      <Link href="/caja" className="-mb-4 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Caja
      </Link>
      <PageHeading title="Escanear pedido" description="Pide al comprador que muestre el QR de su pedido y colócalo frente a la cámara." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <QrScanner />
        <aside className="flex h-fit flex-col gap-4 rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Introducir folio</h2>
          <p className="text-sm text-muted-foreground">Si la cámara no funciona, escribe el folio que aparece bajo el QR del comprador.</p>
          <OrderCodeForm />
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li>El navegador pedirá permiso para usar la cámara la primera vez.</li>
            <li>En teléfonos se usa la cámara trasera; puedes cambiarla en el selector.</li>
            <li>La cámara requiere HTTPS o localhost.</li>
          </ul>
        </aside>
      </div>
    </AppShell>
  )
}
