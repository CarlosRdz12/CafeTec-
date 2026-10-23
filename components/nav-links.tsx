'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Principal" className="order-last flex w-full gap-1 overflow-x-auto text-sm md:order-none md:w-auto">
      {links.map((link) => {
        const active = pathname === link.href
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap rounded-lg px-3 py-1.5 transition-colors',
              active ? 'bg-secondary font-medium text-secondary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
