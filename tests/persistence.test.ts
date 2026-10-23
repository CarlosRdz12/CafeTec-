import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { assertIntegrity, migrate } from '@/lib/server/migrations'
import type { Database } from '@/lib/types'

const DATA_DIR = process.env.CAFETEC_DATA_DIR!

/** A database written by the original v1 application. */
function v1Database() {
  return {
    version: 1,
    users: [{ id: 'u1', name: 'Ana', email: 'ana@x.mx', passwordHash: 'scrypt$a$b', role: 'cliente', active: true, createdAt: '2026-01-01T10:00:00.000Z' }],
    products: [{ id: 'p1', name: 'Café', description: '', category: 'bebidas_calientes', priceCents: 2500, stock: 10, lowStockThreshold: 5, available: true, createdAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T10:00:00.000Z' }],
    orders: [
      { id: 'o1', number: 1, userId: 'u1', customerName: 'Ana', items: [{ productId: 'p1', name: 'Café', unitPriceCents: 2500, quantity: 2 }], totalCents: 5000, status: 'entregado', paymentMethod: 'caja', paymentStatus: 'pagado', notes: '', createdAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T11:00:00.000Z' },
      { id: 'o2', number: 2, userId: 'u1', customerName: 'Ana', items: [{ productId: 'p1', name: 'Café', unitPriceCents: 2500, quantity: 1 }], totalCents: 2500, status: 'pendiente', paymentMethod: 'caja', paymentStatus: 'pendiente', notes: '', createdAt: '2026-01-02T10:00:00.000Z', updatedAt: '2026-01-02T10:00:00.000Z' },
    ],
    movements: [{ id: 'm1', productId: 'p1', delta: -2, reason: 'venta', note: 'Pedido #1', userId: 'u1', orderId: 'o1', createdAt: '2026-01-01T10:00:00.000Z' }],
    nextOrderNumber: 3,
  }
}

describe('migración v1 → v2', () => {
  it('keeps every existing record and only adds new fields', () => {
    const original = v1Database()
    const { db, migrated } = migrate(structuredClone(original) as never)
    expect(migrated).toBe(true)
    expect(db.version).toBe(2)
    expect(db.users).toEqual(original.users)
    expect(db.products).toEqual(original.products)
    expect(db.movements).toEqual(original.movements)
    expect(db.nextOrderNumber).toBe(3)
    for (const [i, order] of db.orders.entries()) {
      const { qrToken, ...rest } = order
      expect(rest).toEqual(original.orders[i])
      expect(qrToken).toMatch(/^[A-Za-z0-9_-]{32}$/)
    }
    expect(db.payments).toEqual([])
    expect(db.orderEvents.map((e) => e.orderId)).toEqual(['o1', 'o2'])
    expect(() => assertIntegrity(db)).not.toThrow()
    expect(migrate(db).migrated).toBe(false)
  })

  it('integrity check forbids two successful payments for one order', () => {
    const { db } = migrate(v1Database() as never)
    const payment = { reference: 'X', orderId: 'o2', amountCents: 2500, method: 'efectivo', result: 'exitoso', simulated: false, channel: 'caja', userId: 'u', createdAt: '' } as const
    const bad: Database = { ...db, payments: [{ ...payment, id: 'a', idempotencyKey: '1' }, { ...payment, id: 'b', idempotencyKey: '2' }] }
    expect(() => assertIntegrity(bad)).toThrow('Cobro exitoso duplicado')
  })

  it('upgrades a v1 file on disk, writes a backup and survives a restart', async () => {
    await writeFile(path.join(DATA_DIR, 'cafetec.json'), JSON.stringify(v1Database()), 'utf8')

    const first = await import('@/lib/server/store')
    const db = await first.readDb()
    expect(db.version).toBe(2)
    expect(db.orders).toHaveLength(2)
    const backups = (await readdir(DATA_DIR)).filter((f) => f.startsWith('cafetec.v1.backup-'))
    expect(backups).toHaveLength(1)
    expect(JSON.parse(await readFile(path.join(DATA_DIR, backups[0]), 'utf8'))).toEqual(v1Database())

    // Record a payment, then simulate a server restart with fresh module state.
    const { chargeOrder } = await import('@/lib/server/order-service')
    await chargeOrder({ id: 'caj', name: 'Caja', role: 'cajero' }, { orderId: 'o2', method: 'efectivo', idempotencyKey: 'k1' })
    vi.resetModules()
    const restarted = await import('@/lib/server/store')
    const after = await restarted.readDb()
    expect(after.orders.find((o) => o.id === 'o2')!.paymentStatus).toBe('pagado')
    expect(after.payments).toHaveLength(1)
    expect(after.orders.find((o) => o.id === 'o1')!.qrToken).toBe(db.orders.find((o) => o.id === 'o1')!.qrToken)
    expect((await readdir(DATA_DIR)).filter((f) => f.startsWith('cafetec.v1.backup-'))).toHaveLength(1)
  })
})
