'use client'

import { CreditCard } from 'lucide-react'
import { DEMO_CARDS, type DemoCardId } from '@/lib/domain/payments'
import { cn } from '@/lib/utils'

/** Choose a predefined demo scenario. There are no inputs for card numbers, CVV or PIN. */
export function DemoCardPicker({ value, onChange, disabled }: { value: DemoCardId; onChange: (id: DemoCardId) => void; disabled?: boolean }) {
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium">Tarjeta de prueba</legend>
      <div className="grid gap-2">
        {DEMO_CARDS.map((card) => {
          const selected = value === card.id
          const declines = 'failureReason' in card
          return (
            <label
              key={card.id}
              className={cn(
                'flex cursor-pointer flex-col gap-3 rounded-xl border-2 p-3 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40',
                selected ? 'border-primary bg-secondary' : 'border-transparent bg-muted hover:bg-secondary/60',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <input type="radio" name="demo-card" value={card.id} checked={selected} onChange={() => onChange(card.id)} className="accent-primary" />
                  {card.label}
                </span>
                <CreditCard className="size-4 text-muted-foreground" aria-hidden="true" />
              </span>
              <span className="font-mono text-xs tracking-widest text-muted-foreground">{card.masked}</span>
              <span className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{card.holder}</span>
                <span className={declines ? 'text-destructive' : 'text-success'}>{declines ? 'Simula rechazo' : 'Simula aprobación'}</span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
