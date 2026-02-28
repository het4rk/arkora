'use client'

import { useState, type JSX } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useArkoraStore } from '@/store/useArkoraStore'
import { generateAlias } from '@/lib/session'
import { MiniKit } from '@worldcoin/minikit-js'
import type { Room } from '@/lib/types'

interface JoinIdentitySheetProps {
  room: Room | null
  onConfirm: (displayHandle: string, identityMode: 'anonymous' | 'alias' | 'named') => void
  onClose: () => void
}

type IdentityChoice = 'anonymous' | 'alias' | 'named'

const OPTIONS: { mode: IdentityChoice; label: string; sub: string; icon: JSX.Element }[] = [
  { mode: 'anonymous', label: 'Anonymous', sub: 'Random one-time handle', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" /><circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none" /><circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none" /><circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /></svg> },
  { mode: 'alias',     label: 'Alias',     sub: 'Your persistent alias',  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> },
  { mode: 'named',     label: 'Named',     sub: 'Your World ID username', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 15h4M7 11h6M7 9h10" /></svg> },
]

export function JoinIdentitySheet({ room, onConfirm, onClose }: JoinIdentitySheetProps) {
  const { nullifierHash, persistentAlias, identityMode: defaultMode, user } = useArkoraStore()
  const [selected, setSelected] = useState<IdentityChoice>(defaultMode)

  function resolveHandle(mode: IdentityChoice): string {
    if (!nullifierHash) return 'Human #????'
    if (mode === 'alias') {
      return persistentAlias ?? generateAlias(nullifierHash)
    }
    if (mode === 'named') {
      const username = MiniKit.isInstalled() ? (MiniKit.user?.username ?? null) : null
      return username ?? user?.pseudoHandle ?? 'World ID user'
    }
    // anonymous - generate a fresh one-time handle for this room session
    return `Human #${Math.floor(1000 + Math.random() * 9000)}`
  }

  function handleConfirm() {
    onConfirm(resolveHandle(selected), selected)
  }

  return (
    <AnimatePresence>
      {room && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 inset-x-0 z-50 glass-sidebar rounded-t-[var(--r-2xl)] pb-[max(env(safe-area-inset-bottom),24px)]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Handle */}
            <div className="w-9 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-5" />

            <div className="px-5">
              <h2 className="text-text font-bold text-lg mb-1">Join Room</h2>
              <p className="text-text-muted text-sm mb-5 line-clamp-1">
                {room.title}
              </p>

              <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em] mb-3">
                Appear as
              </p>

              <div className="space-y-2 mb-6">
                {OPTIONS.map((opt) => (
                  <button
                    key={opt.mode}
                    onClick={() => setSelected(opt.mode)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-[var(--r-lg)] border transition-all active:scale-[0.98] ${
                      selected === opt.mode
                        ? 'bg-accent/12 border-accent/40'
                        : 'glass'
                    }`}
                  >
                    <div className="shrink-0">{opt.icon}</div>
                    <div className="text-left flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${selected === opt.mode ? 'text-accent' : 'text-text'}`}>
                        {opt.label}
                      </p>
                      <p className="text-[11px] text-text-muted">
                        {opt.mode === 'anonymous' ? resolveHandle('anonymous') : opt.sub}
                      </p>
                    </div>
                    {selected === opt.mode && (
                      <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0 text-accent" fill="none">
                        <path d="M2 7L6 11L12 3" stroke="currentColor" strokeWidth="2.2"
                          strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={handleConfirm}
                className="w-full bg-accent text-background font-semibold py-3.5 rounded-[var(--r-lg)] text-sm active:scale-[0.98] active:bg-accent-hover transition-all"
              >
                Enter Room
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
