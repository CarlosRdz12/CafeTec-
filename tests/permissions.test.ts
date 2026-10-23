import { beforeAll, describe, expect, it } from 'vitest'
import { adjustStockAction, createUserAction, deleteProductAction, saveProductAction, updateUserAction } from '@/app/actions/admin'
import { cashierChargeAction, resolveOrderCodeAction, verifyPaymentAction } from '@/app/actions/cashier'
import { markOrderPaidAction, paySimulatedCardAction, placeOrderAction, updateOrderStatusAction } from '@/app/actions/orders'
import { homeFor } from '@/lib/server/auth'
import { readDb } from '@/lib/server/store'
import type { PublicUser } from '@/lib/types'
import { firstProducts, makeUser, signInAs, signOut } from './helpers'

const DENIED = 'No tienes permiso para realizar esta acción.'

let admin: PublicUser
let cajero: PublicUser
let cliente: PublicUser
let otroCliente: PublicUser
let personal: PublicUser

function form(data: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) fd.set(k, v)
  return fd
}

/** Places an order as a fresh buyer (each buyer may only have 3 active orders). */
async function placeOrder(paymentMethod = 'caja', user?: PublicUser) {
  user ??= await makeUser('cliente', 'Comprador Nuevo')
  await signInAs(user)
  const [p] = await firstProducts(1)
  const res = await placeOrderAction({ items: [{ productId: p.id, quantity: 1 }], paymentMethod, notes: '' })
  if (!res.ok) throw new Error(res.error)
  return res.data!
}

beforeAll(async () => {
  admin = await makeUser('admin', 'Admin Prueba')
  cajero = await makeUser('cajero', 'Carla Caja')
  cliente = await makeUser('cliente', 'Ana García')
  otroCliente = await makeUser('cliente', 'Beto Ruiz')
  personal = await makeUser('personal', 'Pepe Cocina')
})

describe('3. inicio de sesión del cajero', () => {
  it('each role lands on its own panel', () => {
    expect(homeFor('cajero')).toBe('/caja')
    expect(homeFor('admin')).toBe('/admin')
    expect(homeFor('personal')).toBe('/personal')
    expect(homeFor('cliente')).toBe('/menu')
  })
  it('a signed-in cashier can use the counter actions', async () => {
    const order = await placeOrder()
    await signInAs(cajero)
    const res = await resolveOrderCodeAction(`#${order.number}`)
    expect(res).toEqual({ ok: true, data: { id: order.id } })
  })
  it('without a session the counter actions are rejected', async () => {
    await signOut()
    expect(await resolveOrderCodeAction('#1')).toEqual({ ok: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' })
  })
})

describe('11. restricciones del cajero (verificadas en el servidor)', () => {
  beforeAll(async () => signInAs(cajero))

  it('cannot change prices, products or inventory', async () => {
    const [p] = await firstProducts(1)
    await signInAs(cajero)
    const save = await saveProductAction({ ok: true }, form({ id: p.id, name: p.name, description: '', category: p.category, price: '1', stock: String(p.stock), lowStockThreshold: '1', available: 'on' }))
    expect(save).toEqual({ ok: false, error: DENIED })
    expect(await deleteProductAction(p.id)).toEqual({ ok: false, error: DENIED })
    expect(await adjustStockAction({ ok: true }, form({ productId: p.id, delta: '50', reason: 'reabastecimiento', note: '' }))).toEqual({ ok: false, error: DENIED })
    const after = (await readDb()).products.find((x) => x.id === p.id)!
    expect(after.priceCents).toBe(p.priceCents)
    expect(after.stock).toBe(p.stock)
  })

  it('cannot manage accounts or roles', async () => {
    await signInAs(cajero)
    expect(await createUserAction({ ok: true }, form({ name: 'Nuevo Admin', email: 'x@cafetec.test', password: '12345678', role: 'admin' }))).toEqual({ ok: false, error: DENIED })
    expect(await updateUserAction({ userId: admin.id, active: false })).toEqual({ ok: false, error: DENIED })
    expect(await updateUserAction({ userId: cajero.id, role: 'admin' })).toEqual({ ok: false, error: DENIED })
    const db = await readDb()
    expect(db.users.find((u) => u.id === cajero.id)!.role).toBe('cajero')
    expect(db.users.find((u) => u.id === admin.id)!.active).toBe(true)
  })

  it('cannot cancel orders or use the staff "mark paid" shortcut', async () => {
    const order = await placeOrder()
    await signInAs(cajero)
    expect(await updateOrderStatusAction(order.id, 'cancelado')).toEqual({ ok: false, error: 'Ese cambio de estado no está permitido.' })
    expect(await markOrderPaidAction(order.id)).toEqual({ ok: false, error: DENIED })
  })

  it('cannot alter totals: the browser amount is only a confirmation', async () => {
    const order = await placeOrder()
    await signInAs(cajero)
    const forged = await cashierChargeAction({ orderId: order.id, method: 'efectivo', idempotencyKey: crypto.randomUUID(), expectedTotalCents: 1 })
    expect(forged.ok).toBe(false)
    const stored = (await readDb()).orders.find((o) => o.id === order.id)!
    const ok = await cashierChargeAction({ orderId: order.id, method: 'efectivo', idempotencyKey: crypto.randomUUID(), expectedTotalCents: stored.totalCents })
    expect(ok.ok && ok.data!.amountCents).toBe(stored.totalCents)
  })

  it('rejects extra or forged fields (no amount, status or role is taken from the client)', async () => {
    const order = await placeOrder()
    await signInAs(cajero)
    const res = await cashierChargeAction({ orderId: order.id, method: 'bitcoin', idempotencyKey: crypto.randomUUID(), expectedTotalCents: 0 })
    expect(res.ok).toBe(false)
    expect((await readDb()).orders.find((o) => o.id === order.id)!.paymentStatus).toBe('pendiente')
  })
})

describe('12. compradores', () => {
  it('cannot use counter actions or pay orders of others', async () => {
    const order = await placeOrder()
    await signInAs(otroCliente)
    expect(await resolveOrderCodeAction(`#${order.number}`)).toEqual({ ok: false, error: DENIED })
    expect(await verifyPaymentAction(order.id)).toEqual({ ok: false, error: DENIED })
    expect(await cashierChargeAction({ orderId: order.id, method: 'efectivo', idempotencyKey: crypto.randomUUID(), expectedTotalCents: 0 })).toEqual({ ok: false, error: DENIED })
    const pay = await paySimulatedCardAction({ orderId: order.id, card: 'aprobada', idempotencyKey: crypto.randomUUID(), expectedTotalCents: 0 })
    expect(pay).toEqual({ ok: false, error: 'Pedido no encontrado.' })
  })

  it('can pay their own order with the simulated card and gets a receipt', async () => {
    const owner = await makeUser('cliente', 'Dueña Pedido')
    const order = await placeOrder('tarjeta_simulada', owner)
    await signInAs(owner)
    const stored = (await readDb()).orders.find((o) => o.id === order.id)!
    const res = await paySimulatedCardAction({ orderId: order.id, card: 'aprobada', idempotencyKey: crypto.randomUUID(), expectedTotalCents: stored.totalCents })
    expect(res.ok).toBe(true)
    expect(res.ok && res.data).toMatchObject({ result: 'exitoso', simulated: true, amountCents: stored.totalCents })
  })

  it('cashier accounts cannot place orders', async () => {
    await signInAs(cajero)
    const [p] = await firstProducts(1)
    expect(await placeOrderAction({ items: [{ productId: p.id, quantity: 1 }], paymentMethod: 'caja', notes: '' })).toEqual({ ok: false, error: DENIED })
  })
})

describe('14. el administrador conserva sus funciones', () => {
  it('can still manage products, stock, users and orders', async () => {
    await signInAs(admin)
    const [p] = await firstProducts(1)
    expect(await adjustStockAction({ ok: true }, form({ productId: p.id, delta: '5', reason: 'reabastecimiento', note: 'prueba' }))).toMatchObject({ ok: true })
    expect(
      await saveProductAction({ ok: true }, form({ id: p.id, name: p.name, description: p.description, category: p.category, price: String(p.priceCents / 100), stock: String(p.stock + 5), lowStockThreshold: '5', available: 'on' })),
    ).toMatchObject({ ok: true })
    expect(await createUserAction({ ok: true }, form({ name: 'Nueva Cajera', email: 'nueva.caja@cafetec.test', password: '12345678', role: 'cajero' }))).toMatchObject({ ok: true })
    const order = await placeOrder()
    await signInAs(admin)
    expect(await updateOrderStatusAction(order.id, 'cancelado')).toEqual({ ok: true })
    // Admin can also work the counter.
    const other = await placeOrder()
    await signInAs(admin)
    expect((await cashierChargeAction({ orderId: other.id, method: 'tarjeta_simulada', card: 'aprobada', idempotencyKey: crypto.randomUUID(), expectedTotalCents: (await readDb()).orders.find((o) => o.id === other.id)!.totalCents })).ok).toBe(true)
  })

  it('staff board keeps registering counter payments', async () => {
    const order = await placeOrder()
    await signInAs(personal)
    expect(await markOrderPaidAction(order.id)).toEqual({ ok: true })
    expect(await markOrderPaidAction(order.id)).toEqual({ ok: true }) // repeated click: idempotent
    const db = await readDb()
    expect(db.payments.filter((p) => p.orderId === order.id)).toHaveLength(1)
    expect(db.orders.find((o) => o.id === order.id)!.paidMethod).toBe('efectivo')
  })
})
