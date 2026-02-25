'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Pusher from 'pusher-js'
import { usePathname } from 'next/navigation'
import { cn, haptic } from '@/lib/utils'
import { useArkoraStore } from '@/store/useArkoraStore'
import { LeftDrawer } from '@/components/ui/LeftDrawer'
import { SearchSheet } from '@/components/search/SearchSheet'

export function BottomNav() {
  const pathname = usePathname()
  const { setComposerOpen, setSearchOpen, nullifierHash, isVerified, unreadNotificationCount, setUnreadNotificationCount } = useArkoraStore()

  // Fetch the initial unread count on mount, then subscribe to Pusher for
  // real-time DM notification count bumps (replaces 60 s polling interval).
  useEffect(() => {
    if (!nullifierHash || !isVerified) return

    // Hydrate on mount
    void fetch('/api/notifications?countOnly=1')
      .then((r) => r.json())
      .then((j: { success: boolean; data?: { count: number } }) => {
        if (j.success && j.data) setUnreadNotificationCount(j.data.count)
      })
      .catch(() => { /* ignore */ })

    // Real-time bump via Pusher
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER
    if (!pusherKey || !pusherCluster) return

    let pusher: InstanceType<typeof Pusher> | null = null
    try {
      pusher = new Pusher(pusherKey, { cluster: pusherCluster })
      const channel = pusher.subscribe(`user-${nullifierHash}`)
      channel.bind('notif-count', (data: { delta: number }) => {
        const current = useArkoraStore.getState().unreadNotificationCount
        setUnreadNotificationCount(Math.max(0, current + data.delta))
      })
    } catch {
      // Pusher unavailable — notification badge won't update in real-time
      pusher?.disconnect()
      pusher = null
    }

    return () => {
      if (pusher) {
        pusher.unsubscribe(`user-${nullifierHash}`)
        pusher.disconnect()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nullifierHash, isVerified])

  return (
    <>
      <SearchSheet />
      {/* Drawer rendered here so it sits above nav in z-order */}
      <LeftDrawer />

      <nav className="fixed bottom-0 left-0 right-0 z-30" aria-label="Main navigation">
        {/* Liquid glass bar */}
        <div className="glass-nav">
          <div className="max-w-[640px] mx-auto">
          <div className="flex items-center justify-around h-14 px-2">

            {/* Feed */}
            <Link
              href="/"
              onClick={() => haptic('light')}
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

            {/* Alerts (notifications) */}
            <Link
              href="/notifications"
              onClick={() => haptic('light')}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all',
                pathname === '/notifications' ? 'text-white' : 'text-text-muted'
              )}
            >
              <span className="relative">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor"
                  strokeWidth={pathname === '/notifications' ? 2.5 : 1.8}
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent" />
                )}
              </span>
              <span className={cn('text-[10px] font-medium', pathname === '/notifications' && 'text-white')}>
                Alerts
              </span>
            </Link>

            {/* Profile */}
            <Link
              href="/profile"
              onClick={() => haptic('light')}
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
        </div>
      </nav>
    </>
  )
}
