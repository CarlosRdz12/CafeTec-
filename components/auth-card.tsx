import type { ReactNode } from 'react'

export function AuthCard({ title, description, children, footer }: { title: string; description: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold text-primary">{title}</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">{description}</p>
      {children}
      {footer && <div className="mt-6 border-t pt-4 text-center text-sm text-muted-foreground">{footer}</div>}
    </div>
  )
}
