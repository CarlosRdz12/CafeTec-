'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateUserAction } from '@/app/actions/admin'
import { ROLE_LABELS, ROLES, type PublicUser, type Role } from '@/lib/types'
import { cn } from '@/lib/utils'
import { inputClass } from '../form-controls'

export function UserRow({ user, isSelf }: { user: PublicUser; isSelf: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function update(input: { role?: Role; active?: boolean }) {
    setError(null)
    startTransition(async () => {
      const res = await updateUserAction({ userId: user.id, ...input })
      if (!res.ok) setError(res.error ?? 'No se pudo actualizar.')
      router.refresh()
    })
  }

  return (
    <tr className={cn('border-b last:border-0', !user.active && 'opacity-60')}>
      <td className="px-4 py-3">
        <p className="font-medium">
          {user.name} {isSelf && <span className="text-xs text-muted-foreground">(tú)</span>}
        </p>
        <p className="text-xs text-muted-foreground">{user.email}</p>
        {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
      </td>
      <td className="px-4 py-3">
        <label className="sr-only" htmlFor={`role-${user.id}`}>Rol de {user.name}</label>
        <select
          id={`role-${user.id}`}
          value={user.role}
          disabled={isSelf || pending}
          onChange={(e) => update({ role: e.target.value as Role })}
          className={cn(inputClass, 'w-auto py-1.5')}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          disabled={isSelf || pending}
          onClick={() => update({ active: !user.active })}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50',
            user.active ? 'text-destructive hover:bg-destructive/10' : 'text-success hover:bg-success/10',
          )}
        >
          {user.active ? 'Desactivar' : 'Reactivar'}
        </button>
      </td>
    </tr>
  )
}
