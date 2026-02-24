'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MiniKit } from '@worldcoin/minikit-js'
import { useArkoraStore, type IdentityMode, type Theme } from '@/store/useArkoraStore'
import { generateAlias } from '@/lib/session'
import { cn } from '@/lib/utils'

const PRIVACY: { mode: IdentityMode; label: string; sub: string; icon: string }[] = [
  { mode: 'anonymous', label: 'Random',  sub: 'New Human # each post',    icon: '🎲' },
  { mode: 'alias',     label: 'Alias',   sub: 'Consistent handle',        icon: '👤' },
  { mode: 'named',     label: 'Named',   sub: 'Your World ID username',   icon: '📛' },
]

const THEMES: { value: Theme; label: string; icon: string }[] = [
  { value: 'dark',  label: 'Dark',  icon: '🌙' },
  { value: 'light', label: 'Light', icon: '☀️' },
]

export function SettingsView() {
  const router = useRouter()
  const {
    identityMode, setIdentityMode,
    theme, setTheme,
    isVerified, nullifierHash, walletAddress,
    persistentAlias, setPersistentAlias,
    user,
  } = useArkoraStore()

  const [aliasDraft, setAliasDraft] = useState(persistentAlias ?? '')

  // ── Subscriptions state ───────────────────────────────────────────────────
  interface SubRow {
    creatorHash: string
    creatorWallet: string
    amountWld: string
    expiresAt: string
    daysLeft: number
    creatorName?: string
  }
  const [subs, setSubs] = useState<SubRow[]>([])
  const [subsLoading, setSubsLoading] = useState(false)
  const [cancellingHash, setCancellingHash] = useState<string | null>(null)

  useEffect(() => {
    if (!nullifierHash || !isVerified) return
    setSubsLoading(true)
    void fetch(`/api/subscribe/list?subscriberHash=${encodeURIComponent(nullifierHash)}`)
      .then((r) => r.json())
      .then((j: { success: boolean; data?: SubRow[] }) => {
        if (j.success && j.data) setSubs(j.data)
      })
      .finally(() => setSubsLoading(false))
  }, [nullifierHash, isVerified])

  async function cancelSub(creatorHash: string) {
    if (!nullifierHash) return
    setCancellingHash(creatorHash)
    try {
      const res = await fetch('/api/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriberHash: nullifierHash, creatorHash }),
      })
      const json = (await res.json()) as { success: boolean }
      if (json.success) setSubs((prev) => prev.filter((s) => s.creatorHash !== creatorHash))
    } finally {
      setCancellingHash(null)
    }
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

  function worldUsername(): string | null {
    return MiniKit.isInstalled() ? (MiniKit.user?.username ?? null) : null
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <div className="flex-1 overflow-y-auto pb-[max(env(safe-area-inset-bottom),80px)]">

        {/* Nav */}
        <div className="px-[5vw] pt-[max(env(safe-area-inset-top),20px)] pb-2">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-text-muted text-sm font-medium active:opacity-60 transition-opacity"
          >
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 1L1 6l5 5" />
            </svg>
            Back
          </button>
        </div>

        <div className="px-[5vw] py-4 space-y-6">
          <h1 className="text-xl font-bold text-text">Settings</h1>

          {/* ── Identity ──────────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.14em]">Identity</p>
            <div className="space-y-2">
              {PRIVACY.map((opt) => (
                <div key={opt.mode}>
                  <button
                    onClick={() => {
                      if (!isVerified) {
                        useArkoraStore.getState().setVerifySheetOpen(true)
                        return
                      }
                      setIdentityMode(opt.mode)
                      // Sync to server so the profile API can gate subscriptions
                      if (nullifierHash) {
                        void fetch('/api/auth/user', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ nullifierHash, identityMode: opt.mode }),
                        }).catch(() => null)
                      }
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
          </section>

          {/* ── Appearance ──────────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.14em]">Appearance</p>
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
          </section>

          {/* ── Account ──────────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.14em]">Account</p>
            <div className="glass rounded-[var(--r-lg)] divide-y divide-white/[0.06]">
              {worldUsername() && (
                <div className="px-4 py-3.5 flex items-center justify-between">
                  <span className="text-text-muted text-sm">World ID</span>
                  <span className="text-text text-sm font-medium">@{worldUsername()}</span>
                </div>
              )}
              {user?.pseudoHandle && (
                <div className="px-4 py-3.5 flex items-center justify-between">
                  <span className="text-text-muted text-sm">Display name</span>
                  <span className="text-text text-sm font-medium">{user.pseudoHandle}</span>
                </div>
              )}
              {walletAddress && (
                <div className="px-4 py-3.5 flex items-center justify-between">
                  <span className="text-text-muted text-sm">Wallet</span>
                  <span className="text-text text-sm font-mono">
                    {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
                  </span>
                </div>
              )}
              <div className="px-4 py-3.5 flex items-center justify-between">
                <span className="text-text-muted text-sm">Verification</span>
                <span className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded-full',
                  isVerified ? 'bg-accent/15 text-accent' : 'bg-downvote/15 text-downvote'
                )}>
                  {isVerified ? '✓ Verified human' : 'Unverified'}
                </span>
              </div>
            </div>
          </section>

          {/* ── Privacy ──────────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.14em]">Privacy</p>
            <div className="glass rounded-[var(--r-lg)] px-4 py-4">
              <p className="text-text-secondary text-sm leading-relaxed">
                Your identity is never stored. Only a cryptographic proof of humanity is used to verify your account — your personal data stays on your device.
              </p>
            </div>
          </section>

          {/* ── Subscriptions ──────────────────────────────────── */}
          {isVerified && (
            <section className="space-y-3">
              <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.14em]">My Subscriptions</p>
              {subsLoading ? (
                <div className="glass rounded-[var(--r-lg)] px-4 py-3 text-text-muted text-sm animate-pulse">Loading…</div>
              ) : subs.length === 0 ? (
                <div className="glass rounded-[var(--r-lg)] px-4 py-3 text-text-muted text-sm">No active subscriptions.</div>
              ) : (
                <div className="glass rounded-[var(--r-lg)] divide-y divide-white/[0.06]">
                  {subs.map((sub) => (
                    <div key={sub.creatorHash} className="px-4 py-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-text text-sm font-medium truncate">
                          Human #{sub.creatorHash.slice(-6)}
                        </p>
                        <p className="text-text-muted text-xs mt-0.5">
                          {sub.daysLeft}d remaining · {sub.amountWld} WLD/mo
                        </p>
                      </div>
                      <button
                        onClick={() => void cancelSub(sub.creatorHash)}
                        disabled={cancellingHash === sub.creatorHash}
                        className="shrink-0 px-3 py-1.5 glass rounded-[var(--r-full)] text-xs text-downvote font-semibold active:scale-95 transition-all disabled:opacity-40"
                      >
                        {cancellingHash === sub.creatorHash ? '…' : 'Cancel'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── About ──────────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.14em]">About</p>
            <div className="glass rounded-[var(--r-lg)] divide-y divide-white/[0.06]">
              <div className="px-4 py-3.5 flex items-center justify-between">
                <span className="text-text-muted text-sm">Version</span>
                <span className="text-text-muted text-sm">1.0.0</span>
              </div>
              <div className="px-4 py-3.5">
                <p className="text-text-muted text-xs text-center leading-relaxed">
                  Every voice is a verified human.<br />
                  Powered by World ID
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
