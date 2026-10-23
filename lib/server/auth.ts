import 'server-only'
import { redirect } from 'next/navigation'
import type { PublicUser, Role, User } from '@/lib/types'
import { readSessionUserId } from './session'
import { readDb } from './store'

export function toPublicUser({ passwordHash: _omit, ...user }: User): PublicUser {
  return user
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const userId = await readSessionUserId()
  if (!userId) return null
  const db = await readDb()
  const user = db.users.find((u) => u.id === userId && u.active)
  return user ? toPublicUser(user) : null
}

/** For pages: redirects instead of throwing. */
export async function requirePageRole(roles: Role[]): Promise<PublicUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!roles.includes(user.role)) redirect('/')
  return user
}

export class AuthError extends Error {}

/** For server actions: throws so the action returns an error message. */
export async function requireActionRole(roles: Role[]): Promise<PublicUser> {
  const user = await getCurrentUser()
  if (!user) throw new AuthError('Tu sesión expiró. Vuelve a iniciar sesión.')
  if (!roles.includes(user.role)) throw new AuthError('No tienes permiso para realizar esta acción.')
  return user
}

export function homeFor(role: Role) {
  if (role === 'admin') return '/admin'
  if (role === 'personal') return '/personal'
  if (role === 'cajero') return '/caja'
  return '/menu'
}
