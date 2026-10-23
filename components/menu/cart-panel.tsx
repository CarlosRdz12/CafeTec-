'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { placeOrderAction } from '@/app/actions/orders'
import { formatMoney, formatOrderNumber } from '@/lib/format'
import { PAYMENT_LABELS, type PaymentMethod } from '@/lib/types'
import { cn } from '@/lib/utils'
import { FormMessage, inputClass } from '../form-controls'
import { SimulationBanner } from '../payments/simulation-banner'
import type { MenuProduct } from './menu-browser'

export function CartPanel({
  lines,
  signedIn,
  canOrder,
  onlinePaymentEnabled,
  simulatedCardEnabled,
  onClear,
}: {
  lines: { product: MenuProduct; quantity: number }[]
  signedIn: boolean
  canOrder: boolean
  onlinePaymentEnabled: boolean
  simulatedCardEnabled: boolean
  onClear: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [notes, setNotes] = useState('')
  const [payment, setPayment] = useState<PaymentMethod>('caja')
  const [reviewing, setReviewing] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; error?: string; message?: string } | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)

  const total = lines.reduce((s, l) => s + l.product.priceCents * l.quantity, 0)
  const methods = (['caja', 'tarjeta_simulada', 'en_linea'] as const).filter((m) => m !== 'tarjeta_simulada' || simulatedCardEnabled)

  function submit() {
    if (pending) return
    setResult(null)
    startTransition(async () => {
      const res = await placeOrderAction({
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        paymentMethod: payment,
        notes,
      })
      if (res.ok) {
        onClear()
        setNotes('')
        setReviewing(false)
        if (payment === 'tarjeta_simulada') {
          router.push(`/mis-pedidos/${res.data!.id}/pagar`)
          return
        }
        setCreatedId(res.data!.id)
        setResult({ ok: true, message: `Pedido ${formatOrderNumber(res.data!.number)} enviado. Muestra tu QR y págalo en caja al recogerlo.` })
        router.refresh()
      } else {
        setResult(res)
        setReviewing(false)
      }
    })
  }

  return (
    <aside aria-labelledby="cart-title" className="h-fit rounded-2xl border bg-card p-5 lg:sticky lg:top-24">
      <h2 id="cart-title" className="text-xl font-semibold">{reviewing ? 'Revisa tu pedido' : 'Tu pedido'}</h2>
      {lines.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Agrega productos del menú para empezar.</p>
      ) : reviewing ? (
        <table className="mt-4 w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="pb-2 font-medium">Producto</th>
              <th scope="col" className="pb-2 text-right font-medium">Cant.</th>
              <th scope="col" className="pb-2 text-right font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.product.id} className="border-b last:border-0">
                <td className="py-2 pr-2">
                  {l.product.name}
                  <span className="block text-xs text-muted-foreground">{formatMoney(l.product.priceCents)} c/u</span>
                </td>
                <td className="py-2 text-right tabular-nums">{l.quantity}</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(l.product.priceCents * l.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="mt-4 flex flex-col gap-2 border-b pb-4 text-sm">
          {lines.map((l) => (
            <li key={l.product.id} className="flex justify-between gap-2">
              <span>
                <span className="tabular-nums">{l.quantity}×</span> {l.product.name}
              </span>
              <span className="tabular-nums">{formatMoney(l.product.priceCents * l.quantity)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex items-center justify-between font-semibold">
        <span>Total</span>
        <span className="text-lg tabular-nums text-primary">{formatMoney(total)}</span>
      </div>

      {!signedIn ? (
        <Link href="/login" className="mt-4 block rounded-lg bg-primary px-4 py-2.5 text-center font-medium text-primary-foreground hover:bg-primary/90">
          Inicia sesión para pedir
        </Link>
      ) : !canOrder ? (
        <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Tu cuenta de caja no puede hacer pedidos.</p>
      ) : reviewing ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm">
            Forma de pago: <span className="font-medium">{PAYMENT_LABELS[payment]}</span>
          </p>
          {notes && <p className="rounded-lg bg-muted px-3 py-2 text-sm">Nota: {notes}</p>}
          {payment === 'tarjeta_simulada' && <SimulationBanner compact />}
          <p className="text-xs text-muted-foreground">El total final lo calcula el servidor con los precios vigentes.</p>
          <button
            type="button"
            onClick={submit}
            disabled={pending || lines.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {pending && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />}
            {pending ? 'Enviando…' : payment === 'tarjeta_simulada' ? 'Confirmar y pagar' : 'Confirmar pedido'}
          </button>
          <button type="button" onClick={() => setReviewing(false)} disabled={pending} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">
            Volver y editar
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Forma de pago</legend>
            {methods.map((m) => {
              const disabled = m === 'en_linea' && !onlinePaymentEnabled
              return (
                <label
                  key={m}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                    payment === m && 'border-primary bg-secondary',
                    disabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <input type="radio" name="payment" value={m} checked={payment === m} disabled={disabled} onChange={() => setPayment(m)} className="accent-primary" />
                  {PAYMENT_LABELS[m]}
                  {disabled && <span className="ml-auto text-xs text-muted-foreground">Próximamente</span>}
                  {m === 'tarjeta_simulada' && <span className="ml-auto rounded bg-warning/30 px-1.5 text-[10px] font-bold uppercase text-warning-foreground">Demo</span>}
                </label>
              )
            })}
          </fieldset>
          <label htmlFor="notes" className="text-sm font-medium">
            Notas (opcional)
          </label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} rows={2} placeholder="Ej. sin cebolla" className={inputClass} />
          <FormMessage state={result} />
          <button
            type="button"
            onClick={() => {
              setResult(null)
              setReviewing(true)
            }}
            disabled={lines.length === 0}
            className="rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Revisar pedido
          </button>
          {result?.ok && createdId && (
            <Link href={`/mis-pedidos/${createdId}`} className="text-center text-sm font-medium text-primary underline-offset-4 hover:underline">
              Ver mi pedido y su QR
            </Link>
          )}
        </div>
      )}
    </aside>
  )
}
