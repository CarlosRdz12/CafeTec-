import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ClipboardList, ShoppingBag, Timer } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { getCurrentUser, homeFor } from '@/lib/server/auth'
import { readDb } from '@/lib/server/store'

const STEPS = [
  { icon: ClipboardList, title: 'Elige del menú', text: 'Consulta precios y disponibilidad en tiempo real.' },
  { icon: ShoppingBag, title: 'Haz tu pedido', text: 'Arma tu carrito y confirma en segundos.' },
  { icon: Timer, title: 'Recoge sin filas', text: 'Te avisamos cuando tu pedido esté listo.' },
]

export default async function HomePage() {
  const user = await getCurrentUser()
  if (user) redirect(homeFor(user.role))
  const db = await readDb()
  const needsSetup = !db.users.some((u) => u.role === 'admin')

  return (
    <AppShell>
      {needsSetup && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning bg-warning/15 px-4 py-3 text-sm">
          <p>CafeTEC aún no tiene administrador. Completa la configuración inicial para gestionar el sistema.</p>
          <Link href="/configuracion-inicial" className="rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground">
            Configurar ahora
          </Link>
        </div>
      )}
      <section className="grid items-center gap-8 md:grid-cols-2">
        <div className="flex flex-col gap-5">
          <p className="text-sm font-medium uppercase tracking-widest text-accent-foreground/70">Cafetería escolar</p>
          <h1 className="text-4xl font-semibold leading-tight text-primary md:text-5xl">
            Tu comida de la cafetería, lista cuando sales de clase.
          </h1>
          <p className="text-pretty text-lg text-muted-foreground">
            Pide desde tu celular, paga en caja al recoger y evita la fila del receso.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/menu" className="rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:bg-primary/90">
              Ver el menú
            </Link>
            <Link href="/registro" className="rounded-lg border bg-card px-5 py-2.5 font-medium hover:bg-muted">
              Crear cuenta
            </Link>
          </div>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border">
          <Image src="/images/cafeteria.png" alt="Capuchino, torta, fruta y galletas sobre el mostrador de la cafetería" fill priority className="object-cover" sizes="(min-width: 768px) 50vw, 100vw" />
        </div>
      </section>
      <section aria-labelledby="como-funciona" className="flex flex-col gap-4">
        <h2 id="como-funciona" className="text-2xl font-semibold">Cómo funciona</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-2 rounded-xl border bg-card p-5">
              <step.icon className="size-6 text-accent" aria-hidden="true" />
              <p className="font-semibold">
                {i + 1}. {step.title}
              </p>
              <p className="text-sm text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </AppShell>
  )
}
