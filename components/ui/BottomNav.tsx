'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn, haptic } from '@/lib/utils'
import { useArkoraStore } from '@/store/useArkoraStore'
import { LeftDrawer } from '@/components/ui/LeftDrawer'
import { SearchSheet } from '@/components/search/SearchSheet'

export function BottomNav() {
  const pathname = usePathname()
  const { setComposerOpen, setDrawerOpen, setSearchOpen } = useArkoraStore()

  return (
    <>
      <SearchSheet />
      {/* Drawer rendered here so it sits above nav in z-order */}
      <LeftDrawer />

      <nav className="fixed bottom-0 left-0 right-0 z-30 safe-bottom">
        {/* Liquid glass bar */}
        <div className="glass-nav">
          <div className="flex items-center justify-around h-14 px-2">

            {/* Menu */}
            <button
              onClick={() => { haptic('light'); setDrawerOpen(true) }}
              aria-label="Open settings"
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all active:scale-90"
            >
              <svg width="20" height="14" viewBox="0 0 20 14" fill="none"
                stroke="currentColor" className="text-text-muted"
                strokeWidth="1.8" strokeLinecap="round">
                <line x1="0" y1="1"  x2="20" y2="1"  />
                <line x1="0" y1="7"  x2="20" y2="7"  />
                <line x1="0" y1="13" x2="20" y2="13" />
              </svg>
              <span className="text-[10px] font-medium text-text-muted">Menu</span>
            </button>

            {/* Feed */}
            <Link
              href="/"
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all',
                pathname === '/' ? 'text-white' : 'text-text-muted'
              )}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor"
                strokeWidth={pathname === '/' ? 2.5 : 1.8}
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              <span className={cn('text-[10px] font-medium', pathname === '/' && 'text-white')}>
                Feed
              </span>
            </Link>

            {/* Compose FAB */}
            <button
              onClick={() => { haptic('medium'); setComposerOpen(true) }}
              className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center shadow-lg shadow-accent/30 active:scale-95 transition-all active:bg-accent-hover"
              aria-label="Create post"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>

            {/* Search */}
            <button
              onClick={() => { haptic('light'); setSearchOpen(true) }}
              aria-label="Search"
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all active:scale-90"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                className="text-text-muted">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <span className="text-[10px] font-medium text-text-muted">Search</span>
            </button>

            {/* Profile */}
            <Link
              href="/profile"
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all',
                pathname === '/profile' ? 'text-white' : 'text-text-muted'
              )}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor"
                strokeWidth={pathname === '/profile' ? 2.5 : 1.8}
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className={cn('text-[10px] font-medium', pathname === '/profile' && 'text-white')}>
                Profile
              </span>
            </Link>

          </div>
        </div>
      </nav>
    </>
  )
}
