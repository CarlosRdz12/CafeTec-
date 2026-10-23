'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { homeFor } from '@/lib/server/auth'
import { toActionError, type ActionResult } from '@/lib/server/action-result'
import { hashPassword, verifyPassword } from '@/lib/server/password'
import { checkRateLimit } from '@/lib/server/rate-limit'
import { createSession, destroySession } from '@/lib/server/session'
import { mutateDb, newId, readDb } from '@/lib/server/store'
import type { Role } from '@/lib/types'
import { DomainError } from '@/lib/domain/orders'

const emailSchema = z.string().trim().toLowerCase().email('Escribe un correo válido.').max(120)
const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(128, 'La contraseña es demasiado larga.')
const nameSchema = z.string().trim().min(2, 'Escribe tu nombre completo.').max(80, 'El nombre es demasiado largo.')

const registerSchema = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema })
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Escribe tu contraseña.').max(128) })

async function clientKey() {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
}

async function createUser(input: z.infer<typeof registerSchema>, role: Role, onlyIfNoAdmin = false) {
  const passwordHash = await hashPassword(input.password)
  return mutateDb((db) => {
    if (onlyIfNoAdmin && db.users.some((u) => u.role === 'admin')) {
      throw new DomainError('La configuración inicial ya se realizó.')
    }
    if (db.users.some((u) => u.email === input.email)) {
      throw new DomainError('Ya existe una cuenta con ese correo.')
    }
    const user = {
      id: newId(),
      name: input.name,
      email: input.email,
      passwordHash,
      role,
      active: true,
      createdAt: new Date().toISOString(),
    }
    db.users.push(user)
    return user
  })
}

export async function registerAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  let role: Role
  try {
    if (!checkRateLimit(`register:${await clientKey()}`, 5, 15 * 60_000)) {
      return { ok: false, error: 'Demasiados intentos. Espera unos minutos.' }
    }
    const input = registerSchema.parse(Object.fromEntries(formData))
    const user = await createUser(input, 'cliente')
    role = user.role
    await createSession(user.id)
  } catch (error) {
    return toActionError(error)
  }
  redirect(homeFor(role))
}

export async function setupAdminAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const input = registerSchema.parse(Object.fromEntries(formData))
    const user = await createUser(input, 'admin', true)
    await createSession(user.id)
  } catch (error) {
    return toActionError(error)
  }
  redirect('/admin')
}

export async function loginAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  let role: Role
  try {
    const input = loginSchema.parse(Object.fromEntries(formData))
    if (!checkRateLimit(`login:${await clientKey()}:${input.email}`, 8, 15 * 60_000)) {
      return { ok: false, error: 'Demasiados intentos fallidos. Espera 15 minutos.' }
    }
    const db = await readDb()
    const user = db.users.find((u) => u.email === input.email)
    const valid = user ? await verifyPassword(input.password, user.passwordHash) : false
    if (!user || !valid) return { ok: false, error: 'Correo o contraseña incorrectos.' }
    if (!user.active) return { ok: false, error: 'Tu cuenta está desactivada. Contacta a la administración.' }
    role = user.role
    await createSession(user.id)
  } catch (error) {
    return toActionError(error)
  }
  redirect(homeFor(role))
}

export async function logoutAction() {
  await destroySession()
  redirect('/login')
}
