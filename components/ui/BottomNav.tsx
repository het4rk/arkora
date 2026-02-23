'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useArkoraStore } from '@/store/useArkoraStore'

export function BottomNav() {
  const pathname = usePathname()
  const { setComposerOpen } = useArkoraStore()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 safe-bottom">
      {/* Glassmorphism bar */}
      <div className="bg-background/80 backdrop-blur-xl border-t border-white/[0.06]">
        <div className="flex items-center justify-around h-14 px-4">
          <Link
            href="/"
            className={cn(
              'flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl transition-all',
              pathname === '/' ? 'text-white' : 'text-text-muted'
            )}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={pathname === '/' ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <span className={cn('text-[10px] font-medium', pathname === '/' && 'text-white')}>
              Feed
            </span>
          </Link>

          {/* Compose — center prominent button */}
          <button
            onClick={() => setComposerOpen(true)}
            className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center shadow-lg shadow-accent/30 active:scale-95 transition-all active:bg-accent-hover"
            aria-label="Create post"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>

          <Link
            href="/boards"
            className={cn(
              'flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl transition-all',
              pathname === '/boards' ? 'text-white' : 'text-text-muted'
            )}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={pathname === '/boards' ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <span className={cn('text-[10px] font-medium', pathname === '/boards' && 'text-white')}>
              Boards
            </span>
          </Link>
        </div>
      </div>
    </nav>
  )
}
