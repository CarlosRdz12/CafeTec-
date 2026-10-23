import type { ReactNode } from 'react'
import { SiteHeader } from './site-header'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">{children}</main>
    </>
  )
}
