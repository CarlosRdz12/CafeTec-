'use client'

import { Printer } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PrintButton({ label = 'Imprimir', className }: { label?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn('no-print inline-flex items-center justify-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted', className)}
    >
      <Printer className="size-4" aria-hidden="true" />
      {label}
    </button>
  )
}
