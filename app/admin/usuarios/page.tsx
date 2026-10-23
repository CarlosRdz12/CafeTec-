import type { Metadata } from 'next'
import { AppShell } from '@/components/app-shell'
import { PageHeading } from '@/components/form-controls'
import { CreateUserForm } from '@/components/admin/create-user-form'
import { UserRow } from '@/components/admin/user-row'
import { requirePageRole, toPublicUser } from '@/lib/server/auth'
import { readDb } from '@/lib/server/store'

export const metadata: Metadata = { title: 'Usuarios' }

export default async function AdminUsersPage() {
  const me = await requirePageRole(['admin'])
  const db = await readDb()
  const users = db.users.map(toPublicUser).sort((a, b) => a.name.localeCompare(b.name))
  return (
    <AppShell>
      <PageHeading title="Usuarios" description="Crea cuentas de personal y administra roles y accesos." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Usuario</th>
                <th scope="col" className="px-4 py-3 font-medium">Rol</th>
                <th scope="col" className="px-4 py-3 font-medium">Acceso</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow key={u.id} user={u} isSelf={u.id === me.id} />
              ))}
            </tbody>
          </table>
        </div>
        <CreateUserForm />
      </div>
    </AppShell>
  )
}
