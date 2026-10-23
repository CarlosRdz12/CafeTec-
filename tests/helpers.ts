import { hashPassword } from '@/lib/server/password'
import { createSession, destroySession } from '@/lib/server/session'
import { mutateDb, newId } from '@/lib/server/store'
import type { PublicUser, Role } from '@/lib/types'

let counter = 0
let passwordHash: string | undefined

export async function makeUser(role: Role, name = `Usuario ${role} Prueba`): Promise<PublicUser> {
  passwordHash ??= await hashPassword('contrasena-segura')
  const user = {
    id: newId(),
    name,
    email: `${role}${++counter}@cafetec.test`,
    passwordHash,
    role,
    active: true,
    createdAt: new Date().toISOString(),
  }
  await mutateDb((db) => void db.users.push(user))
  const { passwordHash: _omit, ...publicUser } = user
  return publicUser
}

export async function signInAs(user: PublicUser) {
  await createSession(user.id)
}

export async function signOut() {
  await destroySession()
}

export async function firstProducts(n = 2) {
  const { readDb } = await import('@/lib/server/store')
  const db = await readDb()
  return db.products.filter((p) => p.available && p.stock > 5).slice(0, n)
}
