'use client'

import { useActionState } from 'react'
import { adjustStockAction } from '@/app/actions/admin'
import type { ActionResult } from '@/lib/server/action-result'
import { Field, FormMessage, inputClass, SubmitButton, TextInput } from '../form-controls'

export function StockAdjustForm({ products }: { products: { id: string; name: string; stock: number }[] }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(adjustStockAction, { ok: true })
  return (
    <form action={action} className="flex h-fit flex-col gap-4 rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">Registrar movimiento</h2>
      <Field label="Producto" htmlFor="productId">
        <select id="productId" name="productId" required className={inputClass} defaultValue="">
          <option value="" disabled>
            Selecciona…
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.stock})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tipo" htmlFor="reason">
        <select id="reason" name="reason" className={inputClass} defaultValue="reabastecimiento">
          <option value="reabastecimiento">Reabastecimiento (suma)</option>
          <option value="ajuste">Ajuste / merma (usa negativo para restar)</option>
        </select>
      </Field>
      <Field label="Cantidad" htmlFor="delta" hint="Ej. 20 para sumar, -3 para restar.">
        <TextInput id="delta" name="delta" type="number" step={1} required />
      </Field>
      <Field label="Nota" htmlFor="note">
        <TextInput id="note" name="note" maxLength={120} placeholder="Opcional" />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Guardar</SubmitButton>
    </form>
  )
}
