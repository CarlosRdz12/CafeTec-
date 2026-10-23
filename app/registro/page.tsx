import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { AuthCard } from '@/components/auth-card'
import { AuthForm } from '@/components/auth-form'
import { getCurrentUser, homeFor } from '@/lib/server/auth'

export const metadata: Metadata = { title: 'Crear cuenta' }

export default async function RegisterPage() {
  const user = await getCurrentUser()
  if (user) redirect(homeFor(user.role))
  return (
    <AppShell>
      <AuthCard
        title="Crear cuenta"
        description="Para estudiantes y clientes. Las cuentas de personal las crea la administración."
        footer={
          <>
            {'¿Ya tienes cuenta? '}
            <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              Inicia sesión
            </Link>
          </>
        }
      >
        <AuthForm mode="registro" />
      </AuthCard>
    </AppShell>
  )
}
