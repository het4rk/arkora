'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useArkoraStore } from '@/store/useArkoraStore'

const navItems = [
  { href: '/', label: 'Feed', icon: '⚡' },
  { href: '/boards', label: 'Boards', icon: '🏛️' },
]

export function BottomNav() {
  const pathname = usePathname()
  const { setComposerOpen } = useArkoraStore()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-surface border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-0.5 px-6 py-2 rounded-xl transition-colors',
              pathname === item.href
                ? 'text-accent'
                : 'text-text-muted hover:text-text-secondary'
            )}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}

        {/* Compose FAB */}
        <button
          onClick={() => setComposerOpen(true)}
          className="flex flex-col items-center gap-0.5 px-6 py-2 text-accent active:scale-95 transition-transform"
          aria-label="Create post"
        >
          <span className="text-2xl leading-none font-light">+</span>
          <span className="text-[10px] font-medium">Post</span>
        </button>
      </div>
    </nav>
  )
}
