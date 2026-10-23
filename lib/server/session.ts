import 'server-only'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { cookies } from 'next/headers'
import { dataDir } from './store'

export const SESSION_COOKIE = 'cafetec_session'
const SESSION_TTL_SECONDS = 60 * 60 * 12

let cachedSecret: string | null = null

/**
 * Uses SESSION_SECRET when configured; otherwise generates one and stores it
 * next to the data file so sessions survive restarts without hardcoding secrets.
 */
async function getSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) return process.env.SESSION_SECRET
  if (cachedSecret) return cachedSecret
  const file = path.join(dataDir(), 'session.secret')
  try {
    cachedSecret = (await readFile(file, 'utf8')).trim()
  } catch {
    await mkdir(dataDir(), { recursive: true })
    cachedSecret = randomBytes(48).toString('base64url')
    await writeFile(file, cachedSecret, { mode: 0o600 })
  }
  return cachedSecret
}

function sign(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export async function createSession(userId: string) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp })).toString('base64url')
  const token = `${payload}.${sign(payload, await getSecret())}`
  const store = await cookies()
  // SameSite=None + Secure keeps the session working inside the embedded preview iframe.
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export async function readSessionUserId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = Buffer.from(sign(payload, await getSecret()))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub: string; exp: number }
    if (data.exp < Date.now() / 1000) return null
    return data.sub
  } catch {
    return null
  }
}

export async function destroySession() {
  ;(await cookies()).delete({ name: SESSION_COOKIE, path: '/', secure: true, sameSite: 'none' })
}
