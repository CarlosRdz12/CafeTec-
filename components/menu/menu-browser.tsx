'use client'

import { useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { MAX_QTY_PER_PRODUCT } from '@/lib/domain/orders'
import { formatMoney } from '@/lib/format'
import { CATEGORIES, CATEGORY_LABELS, type Category } from '@/lib/types'
import { cn } from '@/lib/utils'
import { EmptyState } from '../form-controls'
import { CartPanel } from './cart-panel'

export interface MenuProduct {
  id: string
  name: string
  description: string
  category: Category
  priceCents: number
  stock: number
}

export function MenuBrowser({
  products,
  signedIn,
  canOrder,
  onlinePaymentEnabled,
  simulatedCardEnabled,
}: {
  products: MenuProduct[]
  signedIn: boolean
  canOrder: boolean
  onlinePaymentEnabled: boolean
  simulatedCardEnabled: boolean
}) {
  const [category, setCategory] = useState<Category | 'todas'>('todas')
  const [cart, setCart] = useState<Record<string, number>>({})

  const visible = category === 'todas' ? products : products.filter((p) => p.category === category)
  const usedCategories = CATEGORIES.filter((c) => products.some((p) => p.category === c))

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, quantity]) => ({ product: products.find((p) => p.id === id), quantity }))
        .filter((l): l is { product: MenuProduct; quantity: number } => Boolean(l.product) && l.quantity > 0),
    [cart, products],
  )

  function setQty(id: string, quantity: number, max: number) {
    setCart((prev) => {
      const next = { ...prev }
      const clamped = Math.max(0, Math.min(quantity, max, MAX_QTY_PER_PRODUCT))
      if (clamped === 0) delete next[id]
      else next[id] = clamped
      return next
    })
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-5">
        <div role="group" aria-label="Filtrar por categoría" className="flex flex-wrap gap-2">
          {(['todas', ...usedCategories] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                category === c ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
              )}
            >
              {c === 'todas' ? 'Todo' : CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState title="Sin productos" description="No hay productos disponibles en esta categoría por ahora." />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {visible.map((p) => {
              const qty = cart[p.id] ?? 0
              const soldOut = p.stock === 0
              const max = Math.min(p.stock, MAX_QTY_PER_PRODUCT)
              return (
                <li key={p.id} className={cn('flex flex-col gap-3 rounded-xl border bg-card p-4', soldOut && 'opacity-60')}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[p.category]}</p>
                      <h3 className="font-sans text-base font-semibold">{p.name}</h3>
                    </div>
                    <p className="font-semibold text-primary">{formatMoney(p.priceCents)}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                  <div className="mt-auto flex items-center justify-between">
                    <p className={cn('text-xs', p.stock <= 5 ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                      {soldOut ? 'Agotado' : p.stock <= 5 ? `Últimas ${p.stock} piezas` : 'Disponible'}
                    </p>
                    {qty === 0 ? (
                      <button
                        type="button"
                        disabled={soldOut}
                        onClick={() => setQty(p.id, 1, max)}
                        className="rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/70 disabled:cursor-not-allowed"
                      >
                        Agregar
                      </button>
                    ) : (
                      <div className="flex items-center gap-2" role="group" aria-label={`Cantidad de ${p.name}`}>
                        <button type="button" onClick={() => setQty(p.id, qty - 1, max)} className="rounded-md border p-1.5 hover:bg-muted" aria-label="Quitar uno">
                          <Minus className="size-3.5" aria-hidden="true" />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold tabular-nums" aria-live="polite">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQty(p.id, qty + 1, max)}
                          disabled={qty >= max}
                          className="rounded-md border p-1.5 hover:bg-muted disabled:opacity-40"
                          aria-label="Agregar uno"
                        >
                          <Plus className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <CartPanel
        lines={lines}
        signedIn={signedIn}
        canOrder={canOrder}
        onlinePaymentEnabled={onlinePaymentEnabled}
        simulatedCardEnabled={simulatedCardEnabled}
        onClear={() => setCart({})}
      />
    </div>
  )
}
