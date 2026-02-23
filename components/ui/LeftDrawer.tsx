'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { MiniKit } from '@worldcoin/minikit-js'
import { useArkoraStore, type IdentityMode, type Theme } from '@/store/useArkoraStore'
import { HumanBadge } from '@/components/ui/HumanBadge'
import { generateAlias } from '@/lib/session'
import { cn } from '@/lib/utils'

/* ─── Privacy options ──────────────────────────────────────────────────── */
const PRIVACY: { mode: IdentityMode; label: string; sub: string; icon: string }[] = [
  { mode: 'anonymous', label: 'Random',  sub: 'New Human # each post',    icon: '🎲' },
  { mode: 'alias',     label: 'Alias',   sub: 'Same handle, always',      icon: '👤' },
  { mode: 'named',     label: 'Named',   sub: 'Your World ID username',   icon: '📛' },
]

/* ─── Theme options ────────────────────────────────────────────────────── */
const THEMES: { value: Theme; label: string; icon: string }[] = [
  { value: 'dark',  label: 'Dark',  icon: '🌙' },
  { value: 'light', label: 'Light', icon: '☀️' },
]

export function LeftDrawer() {
  const {
    isDrawerOpen, setDrawerOpen,
    identityMode, setIdentityMode,
    theme, setTheme,
    isVerified, nullifierHash, persistentAlias,
    user,
  } = useArkoraStore()

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

            {/* ── Identity section ─────────────────────────────────── */}
            <div className="px-6 pt-14 pb-5 border-b border-white/[0.07]">
              <p className="text-text-muted text-[10px] font-semibold uppercase tracking-[0.12em] mb-3">
                Posting as
              </p>
              <HumanBadge label={displayName()} size="md" />
            </div>

            {/* ── Scrollable content ───────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">

              {/* Privacy mode */}
              <div>
                <p className="text-text-muted text-[10px] font-semibold uppercase tracking-[0.12em] mb-3">
                  Privacy
                </p>
                <div className="space-y-2">
                  {PRIVACY.map((opt) => (
                    <button
                      key={opt.mode}
                      onClick={() => {
                        if (!isVerified) {
                          useArkoraStore.getState().setVerifySheetOpen(true)
                          setDrawerOpen(false)
                          return
                        }
                        setIdentityMode(opt.mode)
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all active:scale-[0.98]',
                        identityMode === opt.mode
                          ? 'bg-accent/12 border-accent/40 text-accent'
                          : 'bg-white/[0.04] border-white/[0.07] text-text-secondary'
                      )}
                    >
                      <span className="text-lg leading-none flex-shrink-0">{opt.icon}</span>
                      <div className="text-left">
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
                        <span className="ml-auto text-accent">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                            <path d="M2 7L6 11L12 3" stroke="currentColor" strokeWidth="2"
                              strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                          </svg>
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-white/[0.07]" />

              {/* Appearance / theme */}
              <div>
                <p className="text-text-muted text-[10px] font-semibold uppercase tracking-[0.12em] mb-3">
                  Appearance
                </p>
                <div className="flex gap-2">
                  {THEMES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTheme(t.value)}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-1.5 py-3.5 rounded-2xl border transition-all active:scale-95',
                        theme === t.value
                          ? 'bg-accent/12 border-accent/40'
                          : 'bg-white/[0.04] border-white/[0.07]'
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
            <div className="px-6 pb-10 pt-4 border-t border-white/[0.07]">
              <p className="text-text-muted text-[11px] text-center leading-relaxed">
                Every voice is verified human.
              </p>
              <p className="text-text-muted/50 text-[10px] text-center mt-1">
                Powered by World ID
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
