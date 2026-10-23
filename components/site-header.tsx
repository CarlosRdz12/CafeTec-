import Link from 'next/link'
import { Coffee, LogOut } from 'lucide-react'
import { logoutAction } from '@/app/actions/auth'
import { getCurrentUser } from '@/lib/server/auth'
import { ROLE_LABELS, type Role } from '@/lib/types'
import { NavLinks } from './nav-links'

const LINKS: Record<Role, { href: string; label: string }[]> = {
  cliente: [
    { href: '/menu', label: 'Menú' },
    { href: '/mis-pedidos', label: 'Mis pedidos' },
  ],
  personal: [
    { href: '/personal', label: 'Pedidos' },
    { href: '/personal/inventario', label: 'Inventario' },
    { href: '/menu', label: 'Menú' },
  ],
  cajero: [
    { href: '/caja', label: 'Caja' },
    { href: '/caja/escanear', label: 'Escanear' },
    { href: '/caja/historial', label: 'Historial' },
  ],
  admin: [
    { href: '/admin', label: 'Reportes' },
    { href: '/personal', label: 'Pedidos' },
    { href: '/caja', label: 'Caja' },
    { href: '/admin/menu', label: 'Productos' },
    { href: '/personal/inventario', label: 'Inventario' },
    { href: '/admin/usuarios', label: 'Usuarios' },
  ],
}

export async function SiteHeader() {
  const user = await getCurrentUser()
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-serif text-xl font-semibold text-primary">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Coffee className="size-4" aria-hidden="true" />
          </span>
          CafeTEC
        </Link>
        {user ? (
          <>
            <NavLinks links={LINKS[user.role]} />
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden text-right text-sm leading-tight sm:block">
                <p className="font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Salir
                </button>
              </form>
            </div>
          </>
        ) : (
          <nav className="ml-auto flex items-center gap-2 text-sm" aria-label="Cuenta">
            <Link href="/login" className="rounded-lg px-3 py-1.5 hover:bg-muted">
              Iniciar sesión
            </Link>
            <Link href="/registro" className="rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-primary/90">
              Crear cuenta
            </Link>
          </nav>
        )}
      </div>
    </header>
  )
}
