'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MiniKit } from '@worldcoin/minikit-js'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useArkoraStore } from '@/store/useArkoraStore'
import { usePost } from '@/hooks/usePost'
import { generateAlias } from '@/lib/session'
import { FEATURED_BOARDS } from '@/lib/boards'
import { ANONYMOUS_BOARDS } from '@/lib/types'
import { cn, haptic } from '@/lib/utils'
import { ImagePicker } from '@/components/ui/ImagePicker'
import { QuotedPost } from '@/components/ui/QuotedPost'
import { PollOptionInputs, type PollOption } from '@/components/compose/PollOptionInputs'
import { BoardPicker } from '@/components/ui/BoardPicker'

export function PostComposer() {
  const router = useRouter()
  const {
    isComposerOpen, setComposerOpen,
    composerQuotedPost, setComposerQuotedPost,
    setDrawerOpen,
    identityMode,
    persistentAlias, setPersistentAlias,
    nullifierHash,
    walletAddress,
    user,
    locationEnabled,
    isVerified,
  } = useArkoraStore()
  const { submit, isSubmitting, error } = usePost()

  const [isPoll, setIsPoll] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [boardId, setBoardId] = useState('arkora')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const pollIdCounter = useRef(2)
  const [pollOptions, setPollOptions] = useState<PollOption[]>([{ id: 0, text: '' }, { id: 1, text: '' }])
  const [pollDuration, setPollDuration] = useState<24 | 72 | 168>(72)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // Ensure alias exists when mode is selected
  useEffect(() => {
    if (identityMode === 'alias' && nullifierHash && !persistentAlias) {
      setPersistentAlias(generateAlias(nullifierHash))
    }
  }, [identityMode, nullifierHash, persistentAlias, setPersistentAlias])

  // Load boards from API (to include any user-created boards)
  const [allBoards, setAllBoards] = useState(FEATURED_BOARDS)
  useEffect(() => {
    void fetch('/api/boards')
      .then((r) => r.json())
      .then((j: { success: boolean; data?: typeof FEATURED_BOARDS }) => {
        if (j.success && j.data) setAllBoards(j.data)
      })
      .catch(() => null)
  }, [isComposerOpen])

  function shortWallet(): string | undefined {
    if (!walletAddress) return undefined
    return walletAddress.slice(0, 6) + '…' + walletAddress.slice(-4)
  }

  function getPreviewName(): string {
    if (identityMode === 'alias') {
      return persistentAlias ?? (nullifierHash ? generateAlias(nullifierHash) : 'alias.pending')
    }
    if (identityMode === 'named') {
      const username = MiniKit.isInstalled() ? (MiniKit.user?.username ?? null) : null
      return username ?? user?.pseudoHandle ?? shortWallet() ?? 'World ID user'
    }
    return 'Human #????'
  }

  function getPseudoHandle(): string | undefined {
    if (identityMode === 'alias') {
      return persistentAlias ?? (nullifierHash ? generateAlias(nullifierHash) : undefined)
    }
    if (identityMode === 'named') {
      const username = MiniKit.isInstalled() ? (MiniKit.user?.username ?? null) : null
      return username ?? user?.pseudoHandle ?? shortWallet()
    }
    return undefined
  }

  function removePoll() {
    setIsPoll(false)
    pollIdCounter.current = 2
    setPollOptions([{ id: 0, text: '' }, { id: 1, text: '' }])
    setPollDuration(72)
  }

  async function handleSubmit() {
    if (!title.trim()) return
    if (!isPoll && !body.trim()) return
    if (isPoll && pollOptions.filter((o) => o.text.trim()).length < 2) return

    let lat: number | undefined
    let lng: number | undefined
    if (locationEnabled && typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5_000, enableHighAccuracy: false })
        )
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch { /* silent */ }
    }

    const post = await submit({
      title,
      body: isPoll ? '' : body,
      boardId,
      pseudoHandle: getPseudoHandle(),
      imageUrl: isPoll ? undefined : (imageUrl ?? undefined),
      quotedPostId: composerQuotedPost?.id ?? undefined,
      lat,
      lng,
      ...(isPoll && {
        type: 'poll',
        pollOptions: pollOptions.map((o) => o.text).filter((t) => t.trim()),
        pollDuration,
      }),
    })
    if (post) {
      setTitle('')
      setBody('')
      setImageUrl(null)
      pollIdCounter.current = 2
      setPollOptions([{ id: 0, text: '' }, { id: 1, text: '' }])
      setPollDuration(72)
      setIsPoll(false)
      setBoardId('arkora')
      setComposerQuotedPost(null)
      setComposerOpen(false)
      router.push(`/post/${post.id}`)
    }
  }

  if (!isComposerOpen) return null

  const isAnonymousBoard = ANONYMOUS_BOARDS.has(boardId)

  return (
    <BottomSheet
      isOpen={isComposerOpen}
      onClose={() => { setComposerOpen(false); setComposerQuotedPost(null) }}
      title={composerQuotedPost ? 'Quote post' : 'New post'}
    >
      <div className="space-y-5">

        {/* Board selector */}
        <div>
          <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em] mb-2.5">Board</p>
          <BoardPicker selected={boardId} allBoards={allBoards} onChange={setBoardId} />
          {isAnonymousBoard && (
            <p className="mt-2.5 text-[11px] text-text-muted flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              <span>Your identity is completely hidden on this board - no handle, no profile link.</span>
            </p>
          )}
        </div>

        {/* Quoted post preview */}
        {composerQuotedPost && (
          <QuotedPost post={composerQuotedPost} interactive={false} />
        )}

        {/* Title */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="post-title" className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em]">Title</label>
            <span className="text-text-muted/60 text-[11px] tabular-nums" aria-live="polite">{title.length}/280</span>
          </div>
          <input
            id="post-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 280))}
            placeholder="What's on your mind?"
            className="glass-input w-full rounded-[var(--r-lg)] px-4 py-3.5 text-base"
            autoComplete="off"
          />
        </div>

        {/* Body (text post) or Poll section */}
        {!isPoll ? (
          <div>
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="post-body" className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em]">Body</label>
              {body.length > 8000 && (
                <span className="text-text-muted/60 text-[11px] tabular-nums" aria-live="polite">{body.length}/10000</span>
              )}
            </div>
            <div className="relative">
              <textarea
                id="post-body"
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, 10000))}
                placeholder="Say more…"
                rows={4}
                className="glass-input w-full rounded-[var(--r-lg)] px-4 py-3.5 text-base resize-none leading-relaxed max-h-96 overflow-y-auto"
              />
            </div>
            {/* Add poll - only when not quoting */}
            {!composerQuotedPost && (
              <button
                type="button"
                onClick={() => setIsPoll(true)}
                className="mt-3 flex items-center gap-2 px-3.5 py-2 rounded-full glass border border-white/10 text-[13px] font-medium text-text-secondary hover:text-accent hover:border-accent/30 transition-all active:scale-95 active:opacity-70"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                Add poll
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em]">Poll options</p>
              <button
                type="button"
                onClick={removePoll}
                className="text-[11px] text-text-muted/60 hover:text-text-muted transition-colors active:opacity-60"
              >
                × Remove poll
              </button>
            </div>
            <PollOptionInputs
              options={pollOptions}
              onChange={setPollOptions}
              onAdd={() => {
                if (pollOptions.length >= 4) return
                setPollOptions([...pollOptions, { id: pollIdCounter.current++, text: '' }])
              }}
            />
            <div>
              <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em] mb-2">Duration</p>
              <div className="flex gap-2">
                {([24, 72, 168] as const).map((d) => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => setPollDuration(d)}
                    className={cn(
                      'flex-1 py-2 rounded-[var(--r-full)] text-sm font-medium transition-all active:scale-95',
                      pollDuration === d ? 'bg-accent text-background shadow-sm shadow-accent/30' : 'glass text-text-secondary'
                    )}
                  >
                    {d === 24 ? '24h' : d === 72 ? '3 days' : '7 days'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Identity row */}
        {isVerified ? (
          <button
            type="button"
            onClick={() => {
              setComposerOpen(false)
              setTimeout(() => setDrawerOpen(true), 250)
            }}
            className="w-full flex items-center justify-between px-4 py-3.5 glass rounded-[var(--r-lg)] active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-2">
              <span className="text-text-muted text-xs">Posting as</span>
              <span className="text-accent text-xs font-semibold">{getPreviewName()} ✓</span>
            </div>
            <span className="text-text-muted text-[11px]">
              Change →
            </span>
          </button>
        ) : (
          <div className="w-full flex items-center gap-3 px-4 py-3.5 glass rounded-[var(--r-lg)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            <span className="text-text-secondary text-sm">World ID verification required to post</span>
          </div>
        )}

        {/* Image attachment - text post only */}
        {!isPoll && (
          <ImagePicker
            previewUrl={imageUrl}
            onUpload={setImageUrl}
            onClear={() => setImageUrl(null)}
          />
        )}

        {error && (
          <p className="text-text-secondary text-sm rounded-[var(--r-md)] px-4 py-3 bg-surface-up border border-border">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => { haptic('medium'); void handleSubmit() }}
          disabled={
            isSubmitting ||
            !title.trim() ||
            (!isPoll && !body.trim()) ||
            (isPoll && pollOptions.filter((o) => o.text.trim()).length < 2)
          }
          className="w-full bg-accent disabled:opacity-30 text-background font-semibold py-4 rounded-[var(--r-lg)] transition-all active:scale-[0.98] active:bg-accent-hover text-base tracking-[-0.01em] shadow-lg shadow-accent/25"
        >
          {isSubmitting
            ? (isPoll ? 'Creating poll…' : 'Posting…')
            : (isPoll ? 'Create poll' : 'Post')}
        </button>
      </div>
    </BottomSheet>
  )
}
