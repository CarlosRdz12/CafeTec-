import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { AuthCard } from '@/components/auth-card'
import { AuthForm } from '@/components/auth-form'
import { getCurrentUser, homeFor } from '@/lib/server/auth'

export const metadata: Metadata = { title: 'Iniciar sesión' }

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) redirect(homeFor(user.role))
  return (
    <AppShell>
      <AuthCard
        title="Iniciar sesión"
        description="Entra para hacer pedidos o gestionar la cafetería."
        footer={
          <>
            {'¿No tienes cuenta? '}
            <Link href="/registro" className="font-medium text-primary underline-offset-4 hover:underline">
              Regístrate
            </Link>
          </>
        }
      >
        <AuthForm mode="login" />
      </AuthCard>
    </AppShell>
  )
}
