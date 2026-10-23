import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { vi } from 'vitest'

// Every test file gets its own empty data directory.
process.env.CAFETEC_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'cafetec-test-'))
process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret-0123456789'

// Minimal cookie jar so server actions run with a real signed session.
const jar = new Map<string, string>()
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (opts: string | { name: string }) => void jar.delete(typeof opts === 'string' ? opts : opts.name),
  }),
  headers: async () => new Headers({ host: 'localhost:3000', 'x-forwarded-for': '127.0.0.1' }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))
