'use client'

import { useActionState } from 'react'
import { loginAction, registerAction, setupAdminAction } from '@/app/actions/auth'
import type { ActionResult } from '@/lib/server/action-result'
import { Field, FormMessage, SubmitButton, TextInput } from './form-controls'

const ACTIONS = { login: loginAction, registro: registerAction, setup: setupAdminAction }

export function AuthForm({ mode }: { mode: keyof typeof ACTIONS }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(ACTIONS[mode], { ok: true })
  const withName = mode !== 'login'
  return (
    <form action={action} className="flex flex-col gap-4">
      {withName && (
        <Field label="Nombre completo" htmlFor="name">
          <TextInput id="name" name="name" autoComplete="name" required minLength={2} maxLength={80} />
        </Field>
      )}
      <Field label="Correo electrónico" htmlFor="email">
        <TextInput id="email" name="email" type="email" autoComplete="email" required maxLength={120} />
      </Field>
      <Field label="Contraseña" htmlFor="password" hint={withName ? 'Mínimo 8 caracteres.' : undefined}>
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete={withName ? 'new-password' : 'current-password'}
          required
          minLength={withName ? 8 : 1}
          maxLength={128}
        />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pending={pending} className="mt-2 w-full">
        {mode === 'login' ? 'Entrar' : mode === 'setup' ? 'Crear administrador' : 'Crear cuenta'}
      </SubmitButton>
    </form>
  )
}
