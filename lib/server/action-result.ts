import 'server-only'
import { z } from 'zod'
import { DomainError } from '@/lib/domain/orders'
import { AuthError } from './auth'

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string }

/** Converts expected errors into user messages and logs unexpected ones without leaking details. */
export function toActionError(error: unknown): { ok: false; error: string } {
  if (error instanceof DomainError || error instanceof AuthError) return { ok: false, error: error.message }
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? 'Datos inválidos.' }
  console.error('[cafetec] Error inesperado:', error instanceof Error ? error.message : error)
  return { ok: false, error: 'Ocurrió un error inesperado. Intenta de nuevo.' }
}
