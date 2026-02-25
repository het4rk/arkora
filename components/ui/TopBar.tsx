'use client'

import { useRef } from 'react'
import { useArkoraStore } from '@/store/useArkoraStore'
import { haptic } from '@/lib/utils'

export function TopBar() {
  const { setDrawerOpen } = useArkoraStore()
  const touchStartX = useRef<number>(0)

  function openDrawer() {
    haptic('light')
    setDrawerOpen(true)
  }

  return (
    <>
      {/* Swipe-from-left-edge zone — transparent, full height, 20px wide */}
      <div
        className="fixed left-0 top-0 bottom-0 w-5 z-50 pointer-events-auto"
        onTouchStart={(e) => { touchStartX.current = e.touches[0]!.clientX }}
        onTouchEnd={(e) => {
          if (e.changedTouches[0]!.clientX - touchStartX.current > 60) openDrawer()
        }}
      />

      {/* Top bar */}
      <header
        className="fixed top-0 left-0 right-0 z-30 glass-nav-top"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-[640px] mx-auto">
        <div className="relative flex items-center h-14 px-2">
          {/* Hamburger — left */}
          <button
            onClick={openDrawer}
            aria-label="Open menu"
            className="flex items-center justify-center w-10 h-10 rounded-xl active:scale-90 transition-all"
          >
            <svg width="20" height="14" viewBox="0 0 20 14" fill="none"
              stroke="currentColor" className="text-text-muted"
              strokeWidth="1.8" strokeLinecap="round">
              <line x1="0" y1="1"  x2="20" y2="1"  />
              <line x1="0" y1="7"  x2="20" y2="7"  />
              <line x1="0" y1="13" x2="20" y2="13" />
            </svg>
          </button>

          {/* Wordmark — centered */}
          <span className="absolute left-1/2 -translate-x-1/2 text-base font-bold tracking-[-0.03em] text-text select-none">
            Arkora
          </span>
        </div>
        </div>
      </header>
    </>
  )
}
