'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { MiniKit } from '@worldcoin/minikit-js'
import { useArkoraStore, type IdentityMode, type Theme } from '@/store/useArkoraStore'
import { HumanBadge } from '@/components/ui/HumanBadge'
import { generateAlias } from '@/lib/session'
import { cn, formatDisplayName } from '@/lib/utils'
import { SKINS, type SkinId } from '@/lib/skins'

/* ─── Privacy options ──────────────────────────────────────────────────── */
const PRIVACY: { mode: IdentityMode; label: string; sub: string; icon: JSX.Element }[] = [
  { mode: 'anonymous', label: 'Random',  sub: 'New Human # each post',    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" /><circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none" /><circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none" /><circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /></svg> },
  { mode: 'alias',     label: 'Alias',   sub: 'Consistent handle',        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> },
  { mode: 'named',     label: 'Named',   sub: 'Your World ID username',   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 15h4M7 11h6M7 9h10" /></svg> },
]

/* ─── Theme options ────────────────────────────────────────────────────── */
const THEMES: { value: Theme; label: string; icon: JSX.Element }[] = [
  { value: 'dark',  label: 'Dark',  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg> },
  { value: 'light', label: 'Light', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg> },
]

export function LeftDrawer() {
  const router = useRouter()
  const {
    isDrawerOpen, setDrawerOpen,
    identityMode, setIdentityMode,
    theme, setTheme,
    isVerified, nullifierHash, persistentAlias, setPersistentAlias,
    user, signOut,
    activeSkinId, ownedSkins, setActiveSkin,
  } = useArkoraStore()

  const [aliasDraft, setAliasDraft] = useState(persistentAlias ?? '')

  function displayName(): string {
    if (!isVerified) return 'Unverified'
    if (identityMode === 'alias') {
      return persistentAlias ?? (nullifierHash ? generateAlias(nullifierHash) : '…')
    }
    if (identityMode === 'named') {
      const username = MiniKit.isInstalled() ? (MiniKit.user?.username ?? null) : null
      const raw = username ?? user?.pseudoHandle ?? null
      return raw ? formatDisplayName(raw) : 'World ID user'
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
            dragConstraints={{ left: -400, right: 0 }}
            dragElastic={0}
            onDragEnd={(_, info) => {
              if (info.offset.x < -56 || info.velocity.x < -400) {
                setDrawerOpen(false)
              }
            }}
          >
            {/* Subtle top specular line */}
            <div className="absolute inset-x-0 top-0 h-px bg-border/20 pointer-events-none" />

            {/* ── Identity header ───────────────────────────────────── */}
            <div className="px-6 pt-[max(env(safe-area-inset-top),48px)] pb-5 border-b border-border/20">
              {isVerified ? (
                <>
                  <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em] mb-3">
                    Posting as
                  </p>
                  <HumanBadge label={displayName()} size="md" />
                </>
              ) : (
                <>
                  <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em] mb-3">
                    Browsing as guest
                  </p>
                  <p className="text-text-secondary text-sm leading-relaxed mb-4">
                    You can read and search freely. To post, reply, or interact, verify your humanity on-chain with World ID.
                  </p>
                  <button
                    onClick={() => {
                      useArkoraStore.getState().setVerifySheetOpen(true)
                      setDrawerOpen(false)
                    }}
                    className="w-full bg-accent text-background font-semibold py-3 rounded-[var(--r-lg)] text-sm active:scale-[0.98] active:bg-accent-hover transition-all"
                  >
                    Verify with World ID
                  </button>
                </>
              )}
            </div>

            {/* ── Scrollable content ───────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

              {/* Privacy mode — only relevant for verified users */}
              {isVerified && <div>
                <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em] mb-3">
                  Privacy
                </p>
                <div className="space-y-2">
                  {PRIVACY.map((opt) => (
                    <div key={opt.mode}>
                      <button
                        onClick={() => {
                          setIdentityMode(opt.mode)
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3.5 rounded-[var(--r-lg)] border transition-all active:scale-[0.97]',
                          identityMode === opt.mode
                            ? 'bg-accent/12 border-accent/40'
                            : 'glass'
                        )}
                      >
                        <div className="flex-shrink-0">{opt.icon}</div>
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
                            className="px-3 py-2.5 bg-accent text-background text-sm font-semibold rounded-[var(--r-md)] active:scale-95 transition-all shrink-0"
                          >
                            Set
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>}

              {/* Divider */}
              <div className="h-px bg-border/20" />

              {/* Appearance */}
              <div>
                <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em] mb-3">
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
                      <div>{t.icon}</div>
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

              {/* Divider */}
              <div className="h-px bg-border/20" />

              {/* Accent color */}
              <div>
                <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em] mb-3">
                  Accent Color
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SKINS.filter((s) => s.id !== 'hex').map((skin) => {
                    const owned = skin.id === 'monochrome' || ownedSkins.includes(skin.id)
                    const active = activeSkinId === skin.id
                    return (
                      <button
                        key={skin.id}
                        onClick={() => {
                          if (owned) {
                            setActiveSkin(skin.id)
                            void fetch('/api/skins/activate', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ skinId: skin.id }),
                            })
                          } else {
                            setDrawerOpen(false)
                            router.push('/settings')
                          }
                        }}
                        className={cn(
                          'w-7 h-7 rounded-full border-2 transition-all relative',
                          active ? 'border-text scale-110' : owned ? 'border-border' : 'border-border/40 opacity-50'
                        )}
                        style={skin.hex ? { backgroundColor: skin.hex } : undefined}
                      >
                        {skin.id === 'monochrome' && (
                          <div className="absolute inset-0.5 rounded-full overflow-hidden">
                            <div className="absolute inset-0 left-0 right-1/2 bg-black" />
                            <div className="absolute inset-0 left-1/2 bg-white" />
                          </div>
                        )}
                        {!owned && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-md">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* ── Footer ───────────────────────────────────────────── */}
            <div className="px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-4 border-t border-border/20 space-y-3">
              <button
                onClick={() => { setDrawerOpen(false); router.push('/rooms') }}
                className="w-full flex items-center gap-2 px-4 py-3 glass rounded-[var(--r-lg)] text-text-secondary text-sm active:opacity-70 transition-opacity"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>Rooms</span>
              </button>

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

              {isVerified && (
                <button
                  onClick={async () => {
                    setDrawerOpen(false)
                    await fetch('/api/signout', { method: 'POST' })
                    signOut()
                    // Hard reload: remounts WalletConnect so walletAuth re-runs
                    window.location.href = '/'
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 glass rounded-[var(--r-lg)] text-text-muted text-sm active:opacity-70 transition-opacity"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Sign out</span>
                </button>
              )}

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
