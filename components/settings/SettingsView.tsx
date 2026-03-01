'use client'

import { useState, useEffect, useRef, type JSX } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MiniKit } from '@worldcoin/minikit-js'
import { useArkoraStore, type IdentityMode, type Theme } from '@/store/useArkoraStore'
import { generateAlias } from '@/lib/session'
import { cn } from '@/lib/utils'
import { SkinShop } from '@/components/settings/SkinShop'
import { FontShop } from '@/components/settings/FontShop'
import { Avatar } from '@/components/ui/Avatar'
import { AvatarCropper } from '@/components/ui/AvatarCropper'

// Discrete radius options in miles; -1 means "entire country"
const RADIUS_OPTIONS = [1, 5, 10, 25, 50, 100, 250, -1] as const
type RadiusOption = typeof RADIUS_OPTIONS[number]

function radiusLabel(r: RadiusOption): string {
  return r === -1 ? 'Country' : `${r} mi`
}

function radiusIndexOf(miles: number): number {
  const idx = RADIUS_OPTIONS.indexOf(miles as RadiusOption)
  return idx >= 0 ? idx : 4  // default 50mi
}

const PRIVACY: { mode: IdentityMode; label: string; sub: string; icon: JSX.Element }[] = [
  { mode: 'anonymous', label: 'Random',  sub: 'New Human # each post',    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" /><circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none" /><circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none" /><circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /></svg> },
  { mode: 'alias',     label: 'Alias',   sub: 'Consistent handle',        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> },
  { mode: 'named',     label: 'Named',   sub: 'Your World ID username',   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 15h4M7 11h6M7 9h10" /></svg> },
]

const THEMES: { value: Theme; label: string; icon: JSX.Element }[] = [
  { value: 'dark',  label: 'Dark',  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg> },
  { value: 'light', label: 'Light', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg> },
]

export function SettingsView() {
  const router = useRouter()
  const {
    identityMode, setIdentityMode,
    theme, setTheme,
    isVerified, nullifierHash, walletAddress,
    persistentAlias, setPersistentAlias,
    user, setUser,
    locationEnabled, setLocationEnabled,
    locationRadius, setLocationRadius,
    notifyReplies, setNotifyReplies,
    notifyDms, setNotifyDms,
    notifyFollows, setNotifyFollows,
    notifyFollowedPosts, setNotifyFollowedPosts,
    signOut,
    hasExplicitlySignedOut, setHasExplicitlySignedOut,
  } = useArkoraStore()

  // Fire-and-forget sync of preference changes to the server
  const syncPref = (patch: Record<string, unknown>) => {
    void fetch('/api/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => null)
  }

  const [aliasDraft, setAliasDraft] = useState(persistentAlias ?? '')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // ── API Keys state ─────────────────────────────────────────────────────────
  interface ApiKey {
    id: string
    label: string
    createdAt: string
    lastUsedAt: string | null
  }
  const [apiKeysList, setApiKeysList] = useState<ApiKey[]>([])
  const [apiKeysLoading, setApiKeysLoading] = useState(false)
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [creatingKey, setCreatingKey] = useState(false)
  const [newKeyResult, setNewKeyResult] = useState<{ id: string; key: string; label: string } | null>(null)
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null)
  const [keyCopied, setKeyCopied] = useState(false)
  const [showKeyForm, setShowKeyForm] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)

  useEffect(() => {
    if (!nullifierHash || !isVerified) return
    setApiKeysLoading(true)
    void fetch('/api/v1/keys')
      .then((r) => r.json())
      .then((j: { success: boolean; data?: ApiKey[] }) => {
        if (j.success && j.data) setApiKeysList(j.data)
      })
      .finally(() => setApiKeysLoading(false))
  }, [nullifierHash, isVerified])

  async function createApiKey() {
    setCreatingKey(true)
    setKeyError(null)
    try {
      const res = await fetch('/api/v1/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newKeyLabel.trim() }),
      })
      const json = (await res.json()) as { success: boolean; data?: { id: string; label: string; createdAt: string; key: string }; error?: string }
      if (!json.success || !json.data) {
        setKeyError(json.error ?? 'Failed to create key')
        return
      }
      setNewKeyResult({ id: json.data.id, key: json.data.key, label: json.data.label })
      setNewKeyLabel('')
      setShowKeyForm(false)
      setApiKeysList((prev) => [
        { id: json.data!.id, label: json.data!.label, createdAt: json.data!.createdAt, lastUsedAt: null },
        ...prev,
      ])
    } catch {
      setKeyError('Network error - try again')
    } finally {
      setCreatingKey(false)
    }
  }

  async function revokeApiKey(id: string) {
    setRevokingKeyId(id)
    setKeyError(null)
    try {
      const res = await fetch(`/api/v1/keys/${id}`, { method: 'DELETE' })
      const json = (await res.json()) as { success: boolean; error?: string }
      if (json.success) {
        setApiKeysList((prev) => prev.filter((k) => k.id !== id))
      } else {
        setKeyError(json.error ?? 'Failed to revoke key')
      }
    } catch {
      setKeyError('Network error - try again')
    } finally {
      setRevokingKeyId(null)
    }
  }

  function copyKey(key: string) {
    void navigator.clipboard.writeText(key).then(() => {
      setKeyCopied(true)
      setTimeout(() => setKeyCopied(false), 2000)
    })
  }

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
    void fetch('/api/subscribe/list')
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
        body: JSON.stringify({ creatorHash }),
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

  async function deleteAccount() {
    setDeleting(true)
    try {
      await fetch('/api/user', { method: 'DELETE' })
      signOut()
      window.location.href = '/'
    } finally {
      setDeleting(false)
    }
  }

  function worldUsername(): string | null {
    return MiniKit.isInstalled() ? (MiniKit.user?.username ?? null) : null
  }

  async function saveAvatar(url: string | null) {
    if (!nullifierHash) return
    setAvatarSaving(true)
    setAvatarError(null)
    try {
      const res = await fetch('/api/auth/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: url }),
      })
      const json = (await res.json()) as { success: boolean; user?: typeof user; error?: string }
      if (!json.success) throw new Error(json.error ?? 'Failed to save')
      if (json.user) setUser(json.user)
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Failed to save avatar')
    } finally {
      setAvatarSaving(false)
    }
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

          {/* ── Profile Picture ───────────────────────────────────── */}
          {isVerified && (
            <section className="space-y-3">
              <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em]">Profile Picture</p>
              <div className="glass rounded-[var(--r-lg)] p-4 flex items-center gap-4">
                {/* Hidden file input */}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Choose avatar photo"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) setCropFile(f)
                    e.target.value = ''
                  }}
                />
                {/* Avatar preview - tap to change */}
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarSaving}
                  className="relative shrink-0 group"
                  aria-label="Change profile photo"
                >
                  <Avatar avatarUrl={user?.avatarUrl ?? null} label={user?.pseudoHandle ?? nullifierHash} size="lg" className="w-16 h-16 text-xl" />
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-active:opacity-100 transition-opacity">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>
                </button>
                <div className="flex-1 min-w-0 space-y-2">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarSaving}
                    className="flex items-center gap-2 px-3.5 py-2.5 glass rounded-[var(--r-md)] text-sm text-text-secondary active:scale-95 transition-all disabled:opacity-50"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                    <span>{avatarSaving ? 'Saving…' : 'Change photo'}</span>
                  </button>
                  {user?.avatarUrl && (
                    <button
                      type="button"
                      onClick={() => void saveAvatar(null)}
                      disabled={avatarSaving}
                      className="text-xs text-text-muted active:opacity-60 transition-opacity"
                    >
                      Remove photo
                    </button>
                  )}
                  {avatarError && <p className="text-xs text-text-secondary">{avatarError}</p>}
                </div>
              </div>
            </section>
          )}

          {/* Avatar circular cropper */}
          {cropFile && (
            <AvatarCropper
              file={cropFile}
              onCancel={() => setCropFile(null)}
              onConfirm={async (blob) => {
                setCropFile(null)
                setAvatarSaving(true)
                setAvatarError(null)
                try {
                  const form = new FormData()
                  form.append('file', new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
                  const res = await fetch('/api/upload', { method: 'POST', body: form })
                  const json = (await res.json()) as { success: boolean; url?: string; error?: string }
                  if (!json.success || !json.url) throw new Error(json.error ?? 'Upload failed')
                  await saveAvatar(json.url)
                } catch (err) {
                  setAvatarError(err instanceof Error ? err.message : 'Upload failed')
                  setAvatarSaving(false)
                }
              }}
            />
          )}

          {/* ── Identity ──────────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em]">Identity</p>
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
                          body: JSON.stringify({ identityMode: opt.mode }),
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
          </section>

          {/* ── Appearance ──────────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em]">Appearance</p>
            <div className="flex gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => { setTheme(t.value); syncPref({ theme: t.value }) }}
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
          </section>

          {/* ── Accent Color (Skin Shop) ─────────────────────────── */}
          <SkinShop />

          {/* ── Font ──────────────────────────────────────────────── */}
          <FontShop />

          {/* ── Account ──────────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em]">Account</p>
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
                  isVerified ? 'bg-accent/15 text-accent' : 'bg-surface-up text-text-muted'
                )}>
                  {isVerified ? '✓ Verified human' : 'Unverified'}
                </span>
              </div>
            </div>
            {isVerified && (
              <button
                onClick={async () => {
                  await fetch('/api/signout', { method: 'POST' })
                  signOut()
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
            {!isVerified && hasExplicitlySignedOut && (
              <button
                onClick={() => {
                  setHasExplicitlySignedOut(false)
                  window.location.href = '/'
                }}
                className="w-full flex items-center gap-2 px-4 py-3 glass rounded-[var(--r-lg)] text-accent text-sm active:opacity-70 transition-opacity"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                <span>Sign in again</span>
              </button>
            )}
            {isVerified && !deleteConfirm && (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="w-full flex items-center gap-2 px-4 py-3 glass rounded-[var(--r-lg)] text-text-muted/50 text-sm active:opacity-70 transition-opacity"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
                <span>Delete account</span>
              </button>
            )}
            {isVerified && deleteConfirm && (
              <div className="glass rounded-[var(--r-lg)] px-4 py-4 space-y-3">
                <p className="text-text text-sm font-semibold">Delete account?</p>
                <p className="text-text-muted text-xs leading-relaxed">
                  This permanently removes your profile, anonymizes all your posts, and cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => void deleteAccount()}
                    disabled={deleting}
                    className="flex-1 py-2.5 bg-text-muted text-background text-sm font-semibold rounded-[var(--r-md)] active:scale-95 transition-all disabled:opacity-40"
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete'}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="flex-1 py-2.5 glass text-text-secondary text-sm font-semibold rounded-[var(--r-md)] active:opacity-70 transition-opacity"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ── World Chain ──────────────────────────────────────────── */}
          {isVerified && (
            <section className="space-y-3">
              <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em]">World Chain Identity</p>
              <div className="glass rounded-[var(--r-lg)] divide-y divide-white/[0.06]">
                <div className="px-4 py-3.5">
                  <p className="text-text text-sm font-semibold mb-0.5">Verified on-chain</p>
                  <p className="text-text-muted text-xs leading-relaxed">
                    Your humanity proof was validated by World Chain&apos;s smart contracts - not by a central server.
                  </p>
                </div>
                {walletAddress && !walletAddress.startsWith('idkit_') && (
                  <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-text-muted text-xs mb-0.5">Wallet</p>
                      <p className="text-text text-sm font-mono truncate">
                        {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
                      </p>
                    </div>
                    <a
                      href={`https://worldscan.org/address/${walletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 flex items-center gap-1 text-accent text-xs font-semibold active:opacity-70 transition-opacity"
                    >
                      View
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                  </div>
                )}
                {user?.verifiedBlockNumber && (
                  <div className="px-4 py-3.5 flex items-center justify-between">
                    <span className="text-text-muted text-xs">Verified at block</span>
                    <span className="text-text text-xs font-mono tabular-nums">
                      #{user.verifiedBlockNumber.toLocaleString()}
                    </span>
                  </div>
                )}
                {user?.registrationTxHash && (
                  <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                    <span className="text-text-muted text-xs">Registry tx</span>
                    <a
                      href={`https://worldscan.org/tx/${user.registrationTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-accent text-xs font-mono active:opacity-70 transition-opacity"
                    >
                      {user.registrationTxHash.slice(0, 8)}…
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Privacy ──────────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em]">Privacy</p>
            <div className="glass rounded-[var(--r-lg)] px-4 py-4">
              <p className="text-text-secondary text-sm leading-relaxed">
                Your identity is never stored. Only a cryptographic proof of humanity is used to verify your account - your personal data stays on your device.
              </p>
            </div>
          </section>

          {/* ── Location ──────────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em]">Location</p>
            <div className="glass rounded-[var(--r-lg)] px-4 py-4 space-y-4">
              {/* Toggle */}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-text text-sm font-semibold leading-tight">Tag posts with location</p>
                  <p className="text-text-muted text-xs mt-0.5 leading-tight">Your posts will appear in nearby Local feeds</p>
                </div>
                <button
                  onClick={() => { setLocationEnabled(!locationEnabled); syncPref({ locationEnabled: !locationEnabled }) }}
                  className={cn(
                    'relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0',
                    locationEnabled ? 'bg-accent' : 'bg-white/[0.20]'
                  )}
                  aria-label="Toggle location sharing"
                >
                  <span className={cn(
                    'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
                    locationEnabled ? 'translate-x-5' : 'translate-x-0'
                  )} />
                </button>
              </div>

              {/* Radius slider - shown whether or not tagging is on (users still pick their feed radius) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-text-muted text-xs">Local feed radius</p>
                  <p className="text-accent text-xs font-semibold tabular-nums">
                    {radiusLabel(locationRadius as RadiusOption)}
                  </p>
                </div>
                <input
                  type="range"
                  min={0}
                  max={RADIUS_OPTIONS.length - 1}
                  value={radiusIndexOf(locationRadius)}
                  onChange={(e) => {
                    const opt = RADIUS_OPTIONS[parseInt(e.target.value)]
                    if (opt !== undefined) { setLocationRadius(opt); syncPref({ locationRadius: opt }) }
                  }}
                  aria-label="Local feed radius"
                  className="w-full accent-[var(--accent)] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-text-muted/60 px-0.5">
                  <span>1 mi</span>
                  <span>Country</span>
                </div>
              </div>
            </div>
          </section>

          {/* ── Notifications ──────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em]">Notifications</p>
            <div className="glass rounded-[var(--r-lg)] divide-y divide-white/[0.06]">
              {([
                { label: 'Replies', sub: 'When someone replies to your post', value: notifyReplies, setter: setNotifyReplies, key: 'notifyReplies' },
                { label: 'Direct messages', sub: 'When you receive a new DM', value: notifyDms, setter: setNotifyDms, key: 'notifyDms' },
                { label: 'Follows', sub: 'When someone follows you', value: notifyFollows, setter: setNotifyFollows, key: 'notifyFollows' },
                { label: 'Following posts', sub: 'When someone you follow posts', value: notifyFollowedPosts, setter: setNotifyFollowedPosts, key: 'notifyFollowedPosts' },
              ] as const).map((opt) => (
                <div key={opt.label} className="px-4 py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-text text-sm font-semibold leading-tight">{opt.label}</p>
                    <p className="text-text-muted text-xs mt-0.5 leading-tight">{opt.sub}</p>
                  </div>
                  <button
                    onClick={() => { opt.setter(!opt.value); syncPref({ [opt.key]: !opt.value }) }}
                    className={cn(
                      'relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0',
                      opt.value ? 'bg-accent' : 'bg-white/[0.20]'
                    )}
                    aria-label={`Toggle ${opt.label.toLowerCase()} notifications`}
                  >
                    <span className={cn(
                      'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
                      opt.value ? 'translate-x-5' : 'translate-x-0'
                    )} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* ── Subscriptions ──────────────────────────────────── */}
          {isVerified && (
            <section className="space-y-3">
              <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em]">My Subscriptions</p>
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
                          {sub.creatorName ?? `Human #${sub.creatorHash.slice(-6)}`}
                        </p>
                        <p className="text-text-muted text-xs mt-0.5">
                          {sub.daysLeft}d remaining · {sub.amountWld} WLD/mo
                        </p>
                      </div>
                      <button
                        onClick={() => void cancelSub(sub.creatorHash)}
                        disabled={cancellingHash === sub.creatorHash}
                        className="shrink-0 px-3 py-1.5 glass rounded-[var(--r-full)] text-xs text-text-muted font-semibold active:scale-95 transition-all disabled:opacity-40"
                      >
                        {cancellingHash === sub.creatorHash ? '…' : 'Cancel'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── Developer API ──────────────────────────────────── */}
          {isVerified && (
            <section className="space-y-3">
              <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em]">Developer API</p>

              {/* New key revealed - shown once */}
              {newKeyResult && (
                <div className="glass rounded-[var(--r-lg)] p-4 space-y-3 border border-accent/20">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-text text-sm font-semibold">Key created</p>
                      <p className="text-text-muted text-xs mt-0.5">Copy it now - it will not be shown again.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewKeyResult(null)}
                      className="text-text-muted/50 active:opacity-60 transition-opacity mt-0.5 shrink-0"
                      aria-label="Dismiss"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-black/30 rounded-[var(--r-md)] px-3 py-2 text-[11px] font-mono text-accent break-all leading-relaxed min-w-0">
                      {newKeyResult.key}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyKey(newKeyResult.key)}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-2 glass rounded-[var(--r-md)] text-xs font-semibold text-text-secondary active:scale-95 transition-all"
                    >
                      {keyCopied ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                      )}
                      <span>{keyCopied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Create key form */}
              {showKeyForm && !newKeyResult && (
                <div className="glass rounded-[var(--r-lg)] p-4 space-y-3">
                  <p className="text-text text-sm font-semibold">New API key</p>
                  <input
                    type="text"
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value.slice(0, 64))}
                    placeholder="Label (optional)"
                    className="glass-input w-full rounded-[var(--r-md)] px-3 py-2.5 text-sm"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') void createApiKey() }}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void createApiKey()}
                      disabled={creatingKey}
                      className="flex-1 py-2.5 bg-accent text-background text-sm font-semibold rounded-[var(--r-md)] active:scale-95 transition-all disabled:opacity-40"
                    >
                      {creatingKey ? 'Creating…' : 'Create key'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowKeyForm(false); setNewKeyLabel('') }}
                      className="flex-1 py-2.5 glass text-text-secondary text-sm font-semibold rounded-[var(--r-md)] active:opacity-70 transition-opacity"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Existing keys list */}
              {apiKeysLoading ? (
                <div className="glass rounded-[var(--r-lg)] px-4 py-3 text-text-muted text-sm animate-pulse">Loading…</div>
              ) : apiKeysList.length === 0 && !showKeyForm ? (
                <div className="glass rounded-[var(--r-lg)] px-4 py-4 space-y-2">
                  <p className="text-text-secondary text-sm">No API keys yet.</p>
                  <p className="text-text-muted text-xs leading-relaxed">
                    API keys let you query Arkora&apos;s verified-human data programmatically. Only verified users can create keys.
                  </p>
                </div>
              ) : apiKeysList.length > 0 ? (
                <div className="glass rounded-[var(--r-lg)] divide-y divide-white/[0.06]">
                  {apiKeysList.map((k) => (
                    <div key={k.id} className="px-4 py-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-text text-sm font-medium truncate">{k.label || 'Untitled key'}</p>
                        <p className="text-text-muted text-xs mt-0.5">
                          Created {new Date(k.createdAt).toLocaleDateString()}
                          {k.lastUsedAt ? ` · Last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : ' · Never used'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void revokeApiKey(k.id)}
                        disabled={revokingKeyId === k.id}
                        className="shrink-0 px-3 py-1.5 glass rounded-[var(--r-full)] text-xs text-text-muted font-semibold active:scale-95 transition-all disabled:opacity-40"
                      >
                        {revokingKeyId === k.id ? '…' : 'Revoke'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Create button - shown when no form open */}
              {!showKeyForm && !newKeyResult && apiKeysList.length < 5 && (
                <button
                  type="button"
                  onClick={() => setShowKeyForm(true)}
                  className="w-full flex items-center gap-2 px-4 py-3 glass rounded-[var(--r-lg)] text-text-secondary text-sm font-medium active:opacity-70 transition-opacity"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>New API key</span>
                </button>
              )}

              {/* Error display */}
              {keyError && (
                <p className="text-xs text-text-secondary px-1">{keyError}</p>
              )}

              {/* Docs link */}
              <div className="glass rounded-[var(--r-lg)] px-4 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-text-muted text-xs">Base URL</p>
                  <p className="text-text text-xs font-mono mt-0.5">https://arkora.vercel.app/api/v1</p>
                </div>
                <div className="text-text-muted text-xs">
                  <code className="text-[11px] bg-black/20 px-2 py-1 rounded font-mono">X-API-Key: ark_...</code>
                </div>
              </div>
            </section>
          )}

          {/* ── About ──────────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em]">About</p>
            <div className="glass rounded-[var(--r-lg)] divide-y divide-white/[0.06]">
              <div className="px-4 py-3.5 flex items-center justify-between">
                <span className="text-text-muted text-sm">Version</span>
                <span className="text-text-muted text-sm">1.0.0</span>
              </div>
              <Link href="/privacy" className="px-4 py-3.5 flex items-center justify-between active:opacity-60 transition-opacity">
                <span className="text-text-muted text-sm">Privacy Policy</span>
                <svg width="7" height="12" viewBox="0 0 7 12" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className="text-text-muted/50 rotate-180">
                  <path d="M6 1L1 6l5 5" />
                </svg>
              </Link>
              <Link href="/terms" className="px-4 py-3.5 flex items-center justify-between active:opacity-60 transition-opacity">
                <span className="text-text-muted text-sm">Terms of Service</span>
                <svg width="7" height="12" viewBox="0 0 7 12" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className="text-text-muted/50 rotate-180">
                  <path d="M6 1L1 6l5 5" />
                </svg>
              </Link>
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
