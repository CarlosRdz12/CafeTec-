'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { resolveOrderCodeAction } from '@/app/actions/cashier'
import { FormMessage, TextInput } from '../form-controls'

/** Manual fallback for the scanner: type a folio (e.g. 12 or #0012) or paste the QR text. */
export function OrderCodeForm({ autoFocus = false, compact = false }: { autoFocus?: boolean; compact?: boolean }) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pending || !code.trim()) return
    setError(null)
    startTransition(async () => {
      const res = await resolveOrderCodeAction(code)
      if (res.ok) router.push(`/caja/pedido/${res.data!.id}`)
      else setError(res.error)
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2" aria-label="Buscar pedido por folio">
      {!compact && (
        <label htmlFor="order-code" className="text-sm font-medium">
          Folio del pedido
        </label>
      )}
      <div className="flex gap-2">
        <TextInput
          id="order-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Ej. 12 o #0012"
          inputMode="text"
          autoComplete="off"
          autoFocus={autoFocus}
          maxLength={300}
          aria-label={compact ? 'Folio del pedido' : undefined}
          className="text-base"
        />
        <button
          type="submit"
          disabled={pending || !code.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? (
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
          ) : (
            <Search className="size-4" aria-hidden="true" />
          )}
          Buscar
        </button>
      </div>
      <FormMessage state={error ? { ok: false, error } : null} />
    </form>
  )
}
