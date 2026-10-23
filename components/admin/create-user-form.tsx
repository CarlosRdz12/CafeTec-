'use client'

import { useActionState } from 'react'
import { createUserAction } from '@/app/actions/admin'
import type { ActionResult } from '@/lib/server/action-result'
import { ROLE_LABELS, ROLES } from '@/lib/types'
import { Field, FormMessage, inputClass, SubmitButton, TextInput } from '../form-controls'

export function CreateUserForm() {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createUserAction, { ok: true })
  return (
    <form action={action} className="flex h-fit flex-col gap-4 rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">Nuevo usuario</h2>
      <Field label="Nombre" htmlFor="new-name">
        <TextInput id="new-name" name="name" required minLength={2} maxLength={80} />
      </Field>
      <Field label="Correo" htmlFor="new-email">
        <TextInput id="new-email" name="email" type="email" required maxLength={120} autoComplete="off" />
      </Field>
      <Field label="Contraseña temporal" htmlFor="new-password" hint="Mínimo 8 caracteres. Compártela en persona.">
        <TextInput id="new-password" name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" />
      </Field>
      <Field label="Rol" htmlFor="new-role">
        <select id="new-role" name="role" defaultValue="personal" className={inputClass}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </Field>
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Crear usuario</SubmitButton>
    </form>
  )
}
