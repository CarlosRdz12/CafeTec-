import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { AuthCard } from '@/components/auth-card'
import { AuthForm } from '@/components/auth-form'
import { readDb } from '@/lib/server/store'

export const metadata: Metadata = { title: 'Configuración inicial' }

export default async function SetupPage() {
  const db = await readDb()
  if (db.users.some((u) => u.role === 'admin')) redirect('/login')
  return (
    <AppShell>
      <AuthCard
        title="Configuración inicial"
        description="Todavía no hay ningún administrador. Crea la primera cuenta de administración; esta página se desactiva al terminar."
      >
        <AuthForm mode="setup" />
      </AuthCard>
    </AppShell>
  )
}
