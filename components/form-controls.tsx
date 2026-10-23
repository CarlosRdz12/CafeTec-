import type { ComponentProps, ReactNode } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const inputClass =
  'w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-60'

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function TextInput({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(inputClass, className)} {...props} />
}

export function FormMessage({ state }: { state: { ok: boolean; error?: string; message?: string } | null }) {
  if (!state) return null
  if (!state.ok && state.error) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {state.error}
      </p>
    )
  }
  if (state.ok && state.message) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {state.message}
      </p>
    )
  }
  return null
}

export function SubmitButton({ pending, children, className }: { pending: boolean; children: ReactNode; className?: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60',
        className,
      )}
    >
      {pending && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />}
      {children}
    </button>
  )
}

export function PageHeading({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold text-primary">{title}</h1>
        {description && <p className="mt-1 text-pretty text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  )
}

export function EmptyState({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <p className="font-serif text-lg font-semibold">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  )
}
