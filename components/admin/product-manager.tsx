'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { deleteProductAction, saveProductAction } from '@/app/actions/admin'
import type { ActionResult } from '@/lib/server/action-result'
import { formatMoney } from '@/lib/format'
import { CATEGORIES, CATEGORY_LABELS, type Product } from '@/lib/types'
import { Field, FormMessage, inputClass, SubmitButton, TextInput } from '../form-controls'

export function ProductManager({ products }: { products: Product[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<Product | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [pending, startTransition] = useTransition()
  const [listMessage, setListMessage] = useState<ActionResult | null>(null)

  function edit(p: Product | null) {
    setEditing(p)
    setFormKey((k) => k + 1)
  }

  function remove(p: Product) {
    if (!window.confirm(`¿Eliminar "${p.name}"? Esta acción no se puede deshacer.`)) return
    startTransition(async () => {
      const res = await deleteProductAction(p.id)
      setListMessage(res)
      if (res.ok && editing?.id === p.id) edit(null)
      router.refresh()
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-3">
        <FormMessage state={listMessage} />
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Producto</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Precio</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Stock</th>
                <th scope="col" className="px-4 py-3 font-medium">Estado</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Aún no hay productos. Crea el primero.</td>
                </tr>
              )}
              {products.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[p.category]}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(p.priceCents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.stock}</td>
                  <td className="px-4 py-3">
                    <span className={p.available ? 'text-success' : 'text-muted-foreground'}>{p.available ? 'Activo' : 'Inactivo'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => edit(p)} className="rounded-md p-1.5 hover:bg-muted" aria-label={`Editar ${p.name}`}>
                        <Pencil className="size-4" aria-hidden="true" />
                      </button>
                      <button type="button" disabled={pending} onClick={() => remove(p)} className="rounded-md p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-50" aria-label={`Eliminar ${p.name}`}>
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ProductForm key={formKey} product={editing} onCancel={() => edit(null)} />
    </div>
  )
}

function ProductForm({ product, onCancel }: { product: Product | null; onCancel: () => void }) {
  const router = useRouter()
  const [state, setState] = useState<ActionResult | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    startTransition(async () => {
      const res = await saveProductAction({ ok: true }, formData)
      setState(res)
      if (res.ok) {
        if (!product) form.reset()
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-fit flex-col gap-4 rounded-xl border bg-card p-5 lg:sticky lg:top-24">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{product ? 'Editar producto' : 'Nuevo producto'}</h2>
        {product && (
          <button type="button" onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground">
            Nuevo
          </button>
        )}
      </div>
      <input type="hidden" name="id" value={product?.id ?? ''} />
      <Field label="Nombre" htmlFor="name">
        <TextInput id="name" name="name" required maxLength={60} defaultValue={product?.name} />
      </Field>
      <Field label="Descripción" htmlFor="description">
        <textarea id="description" name="description" maxLength={160} rows={2} defaultValue={product?.description} className={inputClass} />
      </Field>
      <Field label="Categoría" htmlFor="category">
        <select id="category" name="category" required defaultValue={product?.category ?? ''} className={inputClass}>
          <option value="" disabled>Selecciona…</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Precio $" htmlFor="price">
          <TextInput id="price" name="price" type="number" min={0.5} step={0.5} required defaultValue={product ? product.priceCents / 100 : undefined} />
        </Field>
        <Field label="Stock" htmlFor="stock">
          <TextInput id="stock" name="stock" type="number" min={0} step={1} required defaultValue={product?.stock ?? 0} />
        </Field>
        <Field label="Mínimo" htmlFor="lowStockThreshold">
          <TextInput id="lowStockThreshold" name="lowStockThreshold" type="number" min={0} step={1} required defaultValue={product?.lowStockThreshold ?? 5} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="available" defaultChecked={product?.available ?? true} className="size-4 accent-primary" />
        Disponible en el menú
      </label>
      <FormMessage state={state} />
      <SubmitButton pending={pending}>{product ? 'Guardar cambios' : 'Crear producto'}</SubmitButton>
    </form>
  )
}
