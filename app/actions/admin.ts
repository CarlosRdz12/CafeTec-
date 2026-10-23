'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { DomainError } from '@/lib/domain/orders'
import { requireActionRole } from '@/lib/server/auth'
import { toActionError, type ActionResult } from '@/lib/server/action-result'
import { hashPassword } from '@/lib/server/password'
import { mutateDb, newId } from '@/lib/server/store'
import { CATEGORIES, ROLES } from '@/lib/types'

const priceSchema = z.coerce
  .number({ message: 'Escribe un precio válido.' })
  .positive('El precio debe ser mayor a 0.')
  .max(10000, 'El precio es demasiado alto.')
  .transform((v) => Math.round(v * 100))

const productSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
  name: z.string().trim().min(2, 'El nombre es obligatorio.').max(60),
  description: z.string().trim().max(160, 'La descripción no puede superar 160 caracteres.').default(''),
  category: z.enum(CATEGORIES, { message: 'Elige una categoría.' }),
  price: priceSchema,
  stock: z.coerce.number().int('El stock debe ser entero.').min(0).max(10000),
  lowStockThreshold: z.coerce.number().int().min(0).max(1000),
  available: z.preprocess((v) => v === 'on' || v === 'true', z.boolean()),
})

export async function saveProductAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireActionRole(['admin'])
    const data = productSchema.parse({ ...Object.fromEntries(formData), available: formData.get('available') })
    const now = new Date().toISOString()
    await mutateDb((db) => {
      const duplicate = db.products.find((p) => p.name.toLowerCase() === data.name.toLowerCase() && p.id !== data.id)
      if (duplicate) throw new DomainError('Ya existe un producto con ese nombre.')
      if (data.id) {
        const product = db.products.find((p) => p.id === data.id)
        if (!product) throw new DomainError('Producto no encontrado.')
        const delta = data.stock - product.stock
        if (delta !== 0) {
          db.movements.push({
            id: newId(),
            productId: product.id,
            delta,
            reason: 'ajuste',
            note: 'Ajuste desde edición de producto',
            userId: user.id,
            createdAt: now,
          })
        }
        Object.assign(product, {
          name: data.name,
          description: data.description,
          category: data.category,
          priceCents: data.price,
          stock: data.stock,
          lowStockThreshold: data.lowStockThreshold,
          available: data.available,
          updatedAt: now,
        })
      } else {
        const id = newId()
        db.products.push({
          id,
          name: data.name,
          description: data.description,
          category: data.category,
          priceCents: data.price,
          stock: data.stock,
          lowStockThreshold: data.lowStockThreshold,
          available: data.available,
          createdAt: now,
          updatedAt: now,
        })
        if (data.stock > 0) {
          db.movements.push({
            id: newId(),
            productId: id,
            delta: data.stock,
            reason: 'reabastecimiento',
            note: 'Stock inicial',
            userId: user.id,
            createdAt: now,
          })
        }
      }
    })
    revalidatePath('/', 'layout')
    return { ok: true, message: data.id ? 'Producto actualizado.' : 'Producto creado.' }
  } catch (error) {
    return toActionError(error)
  }
}

export async function deleteProductAction(productId: string): Promise<ActionResult> {
  try {
    await requireActionRole(['admin'])
    const id = z.string().uuid().parse(productId)
    await mutateDb((db) => {
      const usedInOrders = db.orders.some((o) => o.items.some((i) => i.productId === id))
      if (usedInOrders) {
        throw new DomainError('Este producto tiene pedidos registrados. Desactívalo en lugar de eliminarlo.')
      }
      const before = db.products.length
      db.products = db.products.filter((p) => p.id !== id)
      if (db.products.length === before) throw new DomainError('Producto no encontrado.')
      db.movements = db.movements.filter((m) => m.productId !== id)
    })
    revalidatePath('/', 'layout')
    return { ok: true, message: 'Producto eliminado.' }
  } catch (error) {
    return toActionError(error)
  }
}

const adjustSchema = z.object({
  productId: z.string().uuid(),
  delta: z.coerce
    .number()
    .int('La cantidad debe ser un número entero.')
    .refine((v) => v !== 0, 'La cantidad no puede ser 0.')
    .refine((v) => Math.abs(v) <= 10000, 'Cantidad fuera de rango.'),
  reason: z.enum(['ajuste', 'reabastecimiento']),
  note: z.string().trim().max(120).default(''),
})

export async function adjustStockAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireActionRole(['admin', 'personal'])
    const data = adjustSchema.parse(Object.fromEntries(formData))
    if (data.reason === 'reabastecimiento' && data.delta < 0) {
      throw new DomainError('Un reabastecimiento debe sumar unidades.')
    }
    await mutateDb((db) => {
      const product = db.products.find((p) => p.id === data.productId)
      if (!product) throw new DomainError('Producto no encontrado.')
      if (product.stock + data.delta < 0) throw new DomainError('El stock no puede quedar negativo.')
      product.stock += data.delta
      product.updatedAt = new Date().toISOString()
      db.movements.push({
        id: newId(),
        productId: product.id,
        delta: data.delta,
        reason: data.reason,
        note: data.note,
        userId: user.id,
        createdAt: new Date().toISOString(),
      })
    })
    revalidatePath('/', 'layout')
    return { ok: true, message: 'Inventario actualizado.' }
  } catch (error) {
    return toActionError(error)
  }
}

const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre.').max(80),
  email: z.string().trim().toLowerCase().email('Correo inválido.').max(120),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.').max(128),
  role: z.enum(ROLES),
})

export async function createUserAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    await requireActionRole(['admin'])
    const data = createUserSchema.parse(Object.fromEntries(formData))
    const passwordHash = await hashPassword(data.password)
    await mutateDb((db) => {
      if (db.users.some((u) => u.email === data.email)) throw new DomainError('Ya existe una cuenta con ese correo.')
      db.users.push({
        id: newId(),
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role,
        active: true,
        createdAt: new Date().toISOString(),
      })
    })
    revalidatePath('/admin/usuarios')
    return { ok: true, message: 'Usuario creado.' }
  } catch (error) {
    return toActionError(error)
  }
}

const updateUserSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
})

export async function updateUserAction(input: z.input<typeof updateUserSchema>): Promise<ActionResult> {
  try {
    const admin = await requireActionRole(['admin'])
    const data = updateUserSchema.parse(input)
    if (data.userId === admin.id) throw new DomainError('No puedes modificar tu propio rol o estado.')
    await mutateDb((db) => {
      const user = db.users.find((u) => u.id === data.userId)
      if (!user) throw new DomainError('Usuario no encontrado.')
      if (data.role) user.role = data.role
      if (data.active !== undefined) user.active = data.active
      const activeAdmins = db.users.filter((u) => u.role === 'admin' && u.active).length
      if (activeAdmins === 0) throw new DomainError('Debe quedar al menos un administrador activo.')
    })
    revalidatePath('/admin/usuarios')
    return { ok: true, message: 'Usuario actualizado.' }
  } catch (error) {
    return toActionError(error)
  }
}
