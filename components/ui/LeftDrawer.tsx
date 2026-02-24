'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { MiniKit } from '@worldcoin/minikit-js'
import { useArkoraStore, type IdentityMode, type Theme } from '@/store/useArkoraStore'
import { HumanBadge } from '@/components/ui/HumanBadge'
import { generateAlias } from '@/lib/session'
import { cn } from '@/lib/utils'

/* ─── Privacy options ──────────────────────────────────────────────────── */
const PRIVACY: { mode: IdentityMode; label: string; sub: string; icon: string }[] = [
  { mode: 'anonymous', label: 'Random',  sub: 'New Human # each post',    icon: '🎲' },
  { mode: 'alias',     label: 'Alias',   sub: 'Consistent handle',        icon: '👤' },
  { mode: 'named',     label: 'Named',   sub: 'Your World ID username',   icon: '📛' },
]

/* ─── Theme options ────────────────────────────────────────────────────── */
const THEMES: { value: Theme; label: string; icon: string }[] = [
  { value: 'dark',  label: 'Dark',  icon: '🌙' },
  { value: 'light', label: 'Light', icon: '☀️' },
]

export function LeftDrawer() {
  const router = useRouter()
  const {
    isDrawerOpen, setDrawerOpen,
    identityMode, setIdentityMode,
    theme, setTheme,
    isVerified, nullifierHash, persistentAlias, setPersistentAlias,
    user,
  } = useArkoraStore()

  const [aliasDraft, setAliasDraft] = useState(persistentAlias ?? '')

  function displayName(): string {
    if (!isVerified) return 'Unverified'
    if (identityMode === 'alias') {
      return persistentAlias ?? (nullifierHash ? generateAlias(nullifierHash) : '…')
    }
    if (identityMode === 'named') {
      const username = MiniKit.isInstalled() ? (MiniKit.user?.username ?? null) : null
      return username ?? user?.pseudoHandle ?? 'World ID user'
    }
    return 'Human #????'
  }

  function commitAlias() {
    const trimmed = aliasDraft.trim().slice(0, 32)
    if (trimmed) {
      setPersistentAlias(trimmed)
    } else if (nullifierHash) {
      const generated = generateAlias(nullifierHash)
      setPersistentAlias(generated)
      setAliasDraft(generated)
    }
  }

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <>
          {/* ── Backdrop ─────────────────────────────────────────────── */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setDrawerOpen(false)}
          />

          {/* ── Drawer panel ─────────────────────────────────────────── */}
          <motion.div
            className="fixed left-0 top-0 bottom-0 z-50 w-[78vw] max-w-[310px] flex flex-col glass-sidebar overflow-hidden"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.25, right: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.x < -56 || info.velocity.x < -400) {
                setDrawerOpen(false)
              }
            }}
          >
            {/* Subtle top specular line */}
            <div className="absolute inset-x-0 top-0 h-px bg-white/20 pointer-events-none" />

            {/* ── Identity header ───────────────────────────────────── */}
            <div className="px-6 pt-[max(env(safe-area-inset-top),48px)] pb-5 border-b border-white/[0.07]">
              <p className="text-text-muted text-[10px] font-semibold uppercase tracking-[0.14em] mb-3">
                Posting as
              </p>
              <HumanBadge label={displayName()} size="md" />
            </div>

            {/* ── Scrollable content ───────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

              {/* Privacy mode */}
              <div>
                <p className="text-text-muted text-[10px] font-semibold uppercase tracking-[0.14em] mb-3">
                  Privacy
                </p>
                <div className="space-y-2">
                  {PRIVACY.map((opt) => (
                    <div key={opt.mode}>
                      <button
                        onClick={() => {
                          if (!isVerified) {
                            useArkoraStore.getState().setVerifySheetOpen(true)
                            setDrawerOpen(false)
                            return
                          }
                          setIdentityMode(opt.mode)
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3.5 rounded-[var(--r-lg)] border transition-all active:scale-[0.97]',
                          identityMode === opt.mode
                            ? 'bg-accent/12 border-accent/40'
                            : 'glass'
                        )}
                      >
                        <span className="text-lg leading-none flex-shrink-0">{opt.icon}</span>
                        <div className="text-left min-w-0">
                          <p className={cn(
                            'text-sm font-semibold leading-tight',
                            identityMode === opt.mode ? 'text-accent' : 'text-text'
                          )}>
                            {opt.label}
                          </p>
                          <p className="text-[11px] text-text-muted mt-0.5 leading-tight">
                            {opt.sub}
                          </p>
                        </div>
                        {identityMode === opt.mode && (
                          <svg width="14" height="14" viewBox="0 0 14 14" className="ml-auto shrink-0 text-accent" fill="none">
                            <path d="M2 7L6 11L12 3" stroke="currentColor" strokeWidth="2.2"
                              strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>

                      {/* Alias name input — shown inline when Alias is selected */}
                      {opt.mode === 'alias' && identityMode === 'alias' && (
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            value={aliasDraft}
                            onChange={(e) => setAliasDraft(e.target.value.slice(0, 32))}
                            onBlur={commitAlias}
                            placeholder={nullifierHash ? generateAlias(nullifierHash) : 'Your alias…'}
                            className="glass-input flex-1 rounded-[var(--r-md)] px-3 py-2.5 text-sm min-w-0"
                          />
                          <button
                            onClick={commitAlias}
                            className="px-3 py-2.5 bg-accent text-white text-sm font-semibold rounded-[var(--r-md)] active:scale-95 transition-all shrink-0"
                          >
                            Set
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-white/[0.07]" />

              {/* Appearance */}
              <div>
                <p className="text-text-muted text-[10px] font-semibold uppercase tracking-[0.14em] mb-3">
                  Appearance
                </p>
                <div className="flex gap-2">
                  {THEMES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTheme(t.value)}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-2 py-4 rounded-[var(--r-lg)] border transition-all active:scale-95',
                        theme === t.value
                          ? 'bg-accent/12 border-accent/40'
                          : 'glass'
                      )}
                    >
                      <span className="text-xl leading-none">{t.icon}</span>
                      <span className={cn(
                        'text-xs font-semibold',
                        theme === t.value ? 'text-accent' : 'text-text-secondary'
                      )}>
                        {t.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Footer ───────────────────────────────────────────── */}
            <div className="px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-4 border-t border-white/[0.07] space-y-3">
              <button
                onClick={() => { setDrawerOpen(false); router.push('/settings') }}
                className="w-full flex items-center gap-2 px-4 py-3 glass rounded-[var(--r-lg)] text-text-muted text-sm active:opacity-70 transition-opacity"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                <span>Settings</span>
              </button>
              <p className="text-text-muted/70 text-[11px] text-center leading-relaxed">
                Every voice is verified human.
              </p>
              <p className="text-text-muted/40 text-[10px] text-center">
                Powered by World ID
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
