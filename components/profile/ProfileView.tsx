'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MiniKit } from '@worldcoin/minikit-js'
import { useArkoraStore } from '@/store/useArkoraStore'
import { formatDisplayName } from '@/lib/utils'
import { HumanBadge } from '@/components/ui/HumanBadge'
import { KarmaBadge } from '@/components/ui/KarmaBadge'
import { Avatar } from '@/components/ui/Avatar'
import { ProfilePostCard } from './ProfilePostCard'
import { ProfileReplyCard } from './ProfileReplyCard'
import type { Post, Reply, HumanUser } from '@/lib/types'

type Tab = 'posts' | 'replies' | 'votes' | 'saved'

interface VotedPost extends Post { voteDirection: 1 | -1 }
interface ReplyWithTitle extends Reply { postTitle: string | null }

export function ProfileView() {
  const router = useRouter()
  const { nullifierHash, isVerified, user, setVerified, unreadNotificationCount } = useArkoraStore()
  const [tab, setTab] = useState<Tab>('posts')
  const [posts, setPosts] = useState<Post[]>([])
  const [replies, setReplies] = useState<ReplyWithTitle[]>([])
  const [votes, setVotes] = useState<VotedPost[]>([])
  const [saved, setSaved] = useState<Post[]>([])
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [subscriberCount, setSubscriberCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit bio state
  const [editMode, setEditMode] = useState(false)
  const [bioDraft, setBioDraft] = useState('')
  const [saving, setSaving] = useState(false)

  // Edit display name state
  const [handleEditMode, setHandleEditMode] = useState(false)
  const [handleDraft, setHandleDraft] = useState('')
  const [handleSaving, setHandleSaving] = useState(false)

  // Your own profile always shows your real World ID identity, regardless of chosen identity mode
  function displayName(): string {
    const worldUsername = MiniKit.isInstalled() ? (MiniKit.user?.username ?? null) : null
    const raw = worldUsername ?? user?.pseudoHandle ?? null
    if (raw) return formatDisplayName(raw)
    return nullifierHash ? `Human #${nullifierHash.slice(-6)}` : '…'
  }

  function needsHandle(): boolean {
    const worldUsername = MiniKit.isInstalled() ? (MiniKit.user?.username ?? null) : null
    return !worldUsername && !user?.pseudoHandle
  }

  async function saveHandle() {
    if (!nullifierHash || !user || !handleDraft.trim()) return
    setHandleSaving(true)
    try {
      const res = await fetch('/api/auth/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudoHandle: handleDraft.trim() }),
      })
      const json = (await res.json()) as { success: boolean; user?: typeof user }
      if (json.success && json.user) {
        setVerified(nullifierHash, json.user)
        setHandleEditMode(false)
      }
    } finally {
      setHandleSaving(false)
    }
  }

  function openEdit() {
    setBioDraft(user?.bio ?? '')
    setEditMode(true)
  }

  // Refresh user from server on mount so name/bio are always current
  useEffect(() => {
    if (!nullifierHash || !isVerified) return
    void (async () => {
      try {
        const res = await fetch('/api/auth/user')
        const json = (await res.json()) as { success: boolean; user?: HumanUser }
        if (json.success && json.user) {
          setVerified(nullifierHash, json.user)
        }
      } catch { /* silent — stale store data is acceptable fallback */ }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nullifierHash, isVerified])

  useEffect(() => {
    if (!nullifierHash || !isVerified) return
    void fetchFollowCounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nullifierHash, isVerified])

  useEffect(() => {
    if (!nullifierHash || !isVerified) return
    void fetchTab(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, nullifierHash, isVerified])

  async function fetchFollowCounts() {
    if (!nullifierHash) return
    try {
      const [followRes, subRes] = await Promise.all([
        fetch(`/api/follow?nullifierHash=${encodeURIComponent(nullifierHash)}`),
        fetch(`/api/u/${encodeURIComponent(nullifierHash)}`),
      ])
      const followJson = (await followRes.json()) as { success: boolean; data?: { followerCount: number; followingCount: number } }
      if (followJson.success && followJson.data) {
        setFollowerCount(followJson.data.followerCount)
        setFollowingCount(followJson.data.followingCount)
      }
      const subJson = (await subRes.json()) as { success: boolean; data?: { subscriberCount: number } }
      if (subJson.success && subJson.data) {
        setSubscriberCount(subJson.data.subscriberCount)
      }
    } catch { /* ignore */ }
  }

  async function saveProfile() {
    if (!nullifierHash || !user) return
    setSaving(true)
    try {
      const res = await fetch('/api/auth/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: bioDraft.trim() || null }),
      })
      const json = (await res.json()) as { success: boolean; user?: typeof user }
      if (json.success) {
        setVerified(nullifierHash, { ...user, bio: bioDraft.trim() || null })
        setEditMode(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function fetchTab(t: Tab) {
    if (!nullifierHash) return
    setIsLoading(true)
    setError(null)
    try {
      if (t === 'saved') {
        const res = await fetch(`/api/bookmarks`)
        const json = (await res.json()) as { success: boolean; data?: Post[]; error?: string }
        if (!json.success) throw new Error(json.error ?? 'Failed to load')
        setSaved(json.data ?? [])
      } else {
        const res = await fetch(`/api/profile?tab=${t}`)
        const json = (await res.json()) as { success: boolean; data?: { items: unknown[] }; error?: string }
        if (!json.success) throw new Error(json.error ?? 'Failed to load')

        if (t === 'posts') setPosts(json.data!.items as Post[])
        else if (t === 'replies') setReplies(json.data!.items as ReplyWithTitle[])
        else if (t === 'votes') setVotes(json.data!.items as VotedPost[])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isVerified || !nullifierHash) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-8 text-center">
        <div className="text-4xl mb-5">👤</div>
        <p className="font-bold text-text text-xl mb-2">Your profile</p>
        <p className="text-text-secondary text-sm mb-6 max-w-[260px]">Verify with World ID to see your posts, bookmarks, and activity.</p>
        <button
          onClick={() => useArkoraStore.getState().setVerifySheetOpen(true)}
          className="bg-accent text-white font-semibold py-3.5 px-6 rounded-[var(--r-lg)] text-sm active:scale-[0.98] active:bg-accent-hover transition-all shadow-lg shadow-accent/25"
        >
          Verify with World ID
        </button>
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'posts', label: 'Posts' },
    { id: 'replies', label: 'Replies' },
    { id: 'votes', label: 'Voted' },
    { id: 'saved', label: 'Saved' },
  ]

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <div className="px-[5vw] pt-[max(env(safe-area-inset-top),20px)] pb-0">
        <div className="flex items-center justify-between mb-5">
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
          <div className="flex items-center gap-4">
            {/* Notifications bell */}
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="relative text-text-muted active:opacity-60 transition-opacity"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent" />
              )}
            </Link>
            {/* Messages */}
            <Link
              href="/dm"
              aria-label="Messages"
              className="text-text-muted active:opacity-60 transition-opacity"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </Link>
            {/* Settings gear */}
            <button
              onClick={() => router.push('/settings')}
              aria-label="Settings"
              className="text-text-muted active:opacity-60 transition-opacity"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Identity card */}
        <div className="glass rounded-[var(--r-xl)] px-5 py-5 mb-5">
          {editMode ? (
            /* ── Edit bio mode ── */
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-text-muted uppercase tracking-[0.1em] font-semibold">Bio</label>
                <textarea
                  value={bioDraft}
                  onChange={(e) => setBioDraft(e.target.value.slice(0, 160))}
                  placeholder="Write a short bio…"
                  rows={3}
                  autoFocus
                  className="glass-input w-full rounded-[var(--r-md)] px-3 py-2.5 text-sm resize-none leading-relaxed mt-1"
                />
                <p className="text-[10px] text-text-muted/50 text-right mt-0.5">{bioDraft.length}/160</p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditMode(false)}
                  className="flex-1 py-2.5 text-sm text-text-muted glass rounded-[var(--r-full)] font-semibold active:opacity-70"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void saveProfile()}
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-semibold bg-accent text-white rounded-[var(--r-full)] active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            /* ── View mode ── */
            <>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar avatarUrl={user?.avatarUrl ?? null} label={displayName()} size="md" />
                  <div className="flex flex-col gap-1">
                    <HumanBadge label={displayName()} size="lg" />
                    {user && <KarmaBadge score={user.karmaScore} showScore />}
                  </div>
                </div>
              </div>

              {/* Set display name — only on desktop/IDKit (no World App username available) */}
              {!MiniKit.isInstalled() && needsHandle() && !handleEditMode && (
                <button
                  onClick={() => { setHandleDraft(''); setHandleEditMode(true) }}
                  className="text-accent text-[11px] font-medium mb-2 active:opacity-60 transition-opacity"
                >
                  + Set display name
                </button>
              )}
              {!MiniKit.isInstalled() && handleEditMode && (
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={handleDraft}
                    onChange={(e) => setHandleDraft(e.target.value.slice(0, 50))}
                    placeholder="Display name…"
                    autoFocus
                    className="glass-input flex-1 rounded-[var(--r-md)] px-3 py-2 text-sm min-w-0"
                  />
                  <button
                    onClick={() => void saveHandle()}
                    disabled={!handleDraft.trim() || handleSaving}
                    className="px-3 py-2 bg-accent text-white text-xs font-semibold rounded-[var(--r-md)] active:scale-95 transition-all disabled:opacity-40 shrink-0"
                  >
                    {handleSaving ? '…' : 'Set'}
                  </button>
                  <button
                    onClick={() => setHandleEditMode(false)}
                    className="px-3 py-2 glass text-text-muted text-xs font-semibold rounded-[var(--r-md)] active:opacity-60 shrink-0"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="flex items-center gap-4 text-xs text-text-muted flex-wrap">
                <span><span className="text-text font-semibold">{followerCount}</span> followers</span>
                <span><span className="text-text font-semibold">{followingCount}</span> following</span>
                {subscriberCount > 0 && (
                  <span><span className="text-amber-400 font-semibold">{subscriberCount}</span> subscribers</span>
                )}
              </div>

              {/* World Chain identity link */}
              {user?.walletAddress && !user.walletAddress.startsWith('idkit_') ? (
                <a
                  href={`https://worldscan.org/address/${user.walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-center gap-1.5 text-[11px] text-accent/70 hover:text-accent transition-colors w-fit"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  Verified on World Chain
                  {user.verifiedBlockNumber && (
                    <span className="text-text-muted">· block #{user.verifiedBlockNumber.toLocaleString()}</span>
                  )}
                </a>
              ) : null}

              {user?.bio ? (
                <button onClick={openEdit} className="mt-3 text-left w-full group">
                  <p className="text-text-secondary text-sm leading-relaxed group-active:opacity-70 transition-opacity">
                    {user.bio}
                  </p>
                </button>
              ) : (
                <button onClick={openEdit} className="mt-3">
                  <p className="text-text-muted/50 text-[11px]">+ Add a bio</p>
                </button>
              )}
            </>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-[var(--r-md)] transition-all ${
                tab === t.id
                  ? 'bg-accent text-white'
                  : 'text-text-muted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-[5vw] py-4 pb-[max(env(safe-area-inset-bottom),80px)] space-y-3">
        {isLoading && (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass rounded-[var(--r-lg)] h-20" />
            ))}
          </div>
        )}

        {error && (
          <p className="text-downvote text-sm text-center py-8">{error}</p>
        )}

        {!isLoading && !error && tab === 'posts' && (
          posts.length === 0
            ? <p className="text-text-muted text-sm text-center py-12">No posts yet.</p>
            : posts.map((post) => (
                <ProfilePostCard
                  key={post.id}
                  post={post}
                  onDeleted={(id) => setPosts((p) => p.filter((x) => x.id !== id))}
                />
              ))
        )}

        {!isLoading && !error && tab === 'replies' && (
          replies.length === 0
            ? <p className="text-text-muted text-sm text-center py-12">No replies yet.</p>
            : replies.map((reply) => (
                <ProfileReplyCard
                  key={reply.id}
                  reply={reply}
                  onDeleted={(id) => setReplies((r) => r.filter((x) => x.id !== id))}
                />
              ))
        )}

        {!isLoading && !error && tab === 'votes' && (
          votes.length === 0
            ? <p className="text-text-muted text-sm text-center py-12">No votes yet.</p>
            : votes.map((post) => (
                <div key={post.id} className="relative">
                  <div className={`absolute top-3 right-3 z-10 text-xs font-bold ${post.voteDirection === 1 ? 'text-upvote' : 'text-downvote'}`}>
                    {post.voteDirection === 1 ? '↑' : '↓'}
                  </div>
                  <ProfilePostCard post={post} />
                </div>
              ))
        )}

        {!isLoading && !error && tab === 'saved' && (
          saved.length === 0
            ? <p className="text-text-muted text-sm text-center py-12">No saved posts yet.</p>
            : saved.map((post) => (
                <ProfilePostCard key={post.id} post={post} />
              ))
        )}
      </div>
    </div>
  )
}
