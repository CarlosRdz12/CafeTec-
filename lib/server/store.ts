import 'server-only'
import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { CURRENT_VERSION, assertIntegrity, migrate } from './migrations'
import type { Database } from '@/lib/types'
import { seedProducts } from './seed'

const DATA_DIR = process.env.CAFETEC_DATA_DIR ?? path.join(process.cwd(), '.data')
const DB_FILE = path.join(DATA_DIR, 'cafetec.json')

let queue: Promise<unknown> = Promise.resolve()

function emptyDatabase(): Database {
  return {
    version: CURRENT_VERSION,
    users: [],
    products: seedProducts(),
    orders: [],
    movements: [],
    payments: [],
    orderEvents: [],
    nextOrderNumber: 1,
  }
}

async function load(): Promise<Database> {
  let raw: string
  try {
    raw = await readFile(DB_FILE, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    const db = emptyDatabase()
    await persist(db)
    return db
  }
  const parsed = JSON.parse(raw)
  const fromVersion = parsed.version
  const { db, migrated } = migrate(parsed)
  if (migrated) {
    // Keep the original file untouched before writing the upgraded schema.
    await copyFile(DB_FILE, path.join(DATA_DIR, `cafetec.v${fromVersion ?? 1}.backup-${Date.now()}.json`))
    await persist(db)
    console.info(`[cafetec] Datos migrados de v${fromVersion ?? 1} a v${CURRENT_VERSION}.`)
  }
  return db
}

async function persist(db: Database) {
  assertIntegrity(db)
  await mkdir(DATA_DIR, { recursive: true })
  const tmp = `${DB_FILE}.${randomUUID()}.tmp`
  await writeFile(tmp, JSON.stringify(db, null, 2), 'utf8')
  await rename(tmp, DB_FILE)
}

/** Reads a consistent snapshot after any queued writes finish. */
export function readDb(): Promise<Database> {
  const result = queue.then(load)
  queue = result.catch(() => undefined)
  return result
}

/**
 * Runs a mutation with exclusive access and writes atomically.
 * If the callback throws or an integrity constraint fails, nothing is persisted.
 */
export function mutateDb<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const result = queue.then(async () => {
    const db = await load()
    const value = await fn(db)
    await persist(db)
    return value
  })
  queue = result.catch(() => undefined)
  return result
}

export function newId() {
  return randomUUID()
}

export function dataDir() {
  return DATA_DIR
}
