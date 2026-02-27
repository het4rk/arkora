'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MiniKit } from '@worldcoin/minikit-js'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useArkoraStore } from '@/store/useArkoraStore'
import { usePost } from '@/hooks/usePost'
import { generateAlias } from '@/lib/session'
import { FEATURED_BOARDS, boardLabel, normalizeBoard, resolveBoard } from '@/lib/boards'
import { ANONYMOUS_BOARDS } from '@/lib/types'
import { cn, haptic } from '@/lib/utils'
import { ImagePicker } from '@/components/ui/ImagePicker'
import { QuotedPost } from '@/components/ui/QuotedPost'
import { PollOptionInputs } from '@/components/compose/PollOptionInputs'

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
  const [pollOptions, setPollOptions] = useState<string[]>(['', ''])
  const [pollDuration, setPollDuration] = useState<24 | 72 | 168>(72)
  // Custom board input state
  const [showCustomBoard, setShowCustomBoard] = useState(false)
  const [customBoardInput, setCustomBoardInput] = useState('')
  const customBoardRef = useRef<HTMLInputElement>(null)
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

  function commitCustomBoard() {
    if (!customBoardInput.trim()) { setShowCustomBoard(false); return }
    const resolved = resolveBoard(customBoardInput.trim(), allBoards.map((b) => b.id))
    setBoardId(resolved)
    setShowCustomBoard(false)
    setCustomBoardInput('')
  }

  function removePoll() {
    setIsPoll(false)
    setPollOptions(['', ''])
    setPollDuration(72)
  }

  async function handleSubmit() {
    if (!title.trim()) return
    if (!isPoll && !body.trim()) return
    if (isPoll && pollOptions.filter((o) => o.trim()).length < 2) return

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
        pollOptions: pollOptions.filter((o) => o.trim()),
        pollDuration,
      }),
    })
    if (post) {
      setTitle('')
      setBody('')
      setImageUrl(null)
      setPollOptions(['', ''])
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
  // Board not in featured list — user created it
  const isCustomBoardActive = !FEATURED_BOARDS.some((b) => b.id === boardId)

  return (
    <BottomSheet
      isOpen={isComposerOpen}
      onClose={() => { setComposerOpen(false); setComposerQuotedPost(null) }}
      title={composerQuotedPost ? 'Quote post' : 'New post'}
    >
      <div className="space-y-5">

        {/* Board selector */}
        <div>
          <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em] mb-3">Board</p>
          <div className="flex flex-wrap gap-2">
            {allBoards.map((board) => (
              <button
                type="button"
                key={board.id}
                onClick={() => { setBoardId(board.id); setShowCustomBoard(false) }}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--r-full)] text-sm font-medium transition-all active:scale-95',
                  boardId === board.id
                    ? 'bg-accent text-white shadow-sm shadow-accent/30'
                    : 'glass text-text-secondary'
                )}
              >
                <span className="text-xs">{board.emoji}</span>
                <span>#{board.label ?? boardLabel(board.id)}</span>
              </button>
            ))}

            {/* Custom board chip — shown when user selected a custom board */}
            {isCustomBoardActive && (
              <button
                type="button"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--r-full)] text-sm font-medium bg-accent text-white shadow-sm shadow-accent/30"
              >
                <span className="text-xs">💬</span>
                <span>#{boardLabel(boardId)}</span>
              </button>
            )}

            {/* New board button */}
            {!showCustomBoard && (
              <button
                type="button"
                onClick={() => { setShowCustomBoard(true); setTimeout(() => customBoardRef.current?.focus(), 50) }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--r-full)] text-sm font-medium glass text-text-muted/70 active:scale-95 transition-all"
              >
                <span className="text-xs">+</span>
                <span>New</span>
              </button>
            )}
          </div>

          {/* Custom board input */}
          {showCustomBoard && (
            <div className="mt-2 flex gap-2">
              <input
                ref={customBoardRef}
                type="text"
                value={customBoardInput}
                onChange={(e) => setCustomBoardInput(e.target.value.slice(0, 30))}
                onKeyDown={(e) => { if (e.key === 'Enter') commitCustomBoard() }}
                placeholder="Topic name…"
                className="glass-input flex-1 rounded-[var(--r-md)] px-3 py-2 text-sm min-w-0"
              />
              <button
                type="button"
                onClick={commitCustomBoard}
                disabled={!customBoardInput.trim()}
                className="px-3 py-2 bg-accent text-white text-sm font-semibold rounded-[var(--r-md)] active:scale-95 transition-all disabled:opacity-40 shrink-0"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => { setShowCustomBoard(false); setCustomBoardInput('') }}
                className="px-3 py-2 glass text-text-muted text-sm font-semibold rounded-[var(--r-md)] active:opacity-60 shrink-0"
              >
                ✕
              </button>
            </div>
          )}

          {isAnonymousBoard && (
            <p className="mt-2.5 text-[11px] text-amber-400/80 flex items-center gap-1">
              <span>🤫</span>
              <span>Your identity is completely hidden on this board — no handle, no profile link.</span>
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
                className="glass-input w-full rounded-[var(--r-lg)] px-4 py-3.5 text-base resize-none leading-relaxed"
              />
            </div>
            {/* Add poll — only when not quoting */}
            {!composerQuotedPost && (
              <button
                type="button"
                onClick={() => setIsPoll(true)}
                className="mt-2 flex items-center gap-1.5 text-[11px] text-text-muted/60 hover:text-accent transition-colors active:opacity-60"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                Add poll options
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
                className="text-[11px] text-downvote/60 hover:text-downvote transition-colors active:opacity-60"
              >
                × Remove poll
              </button>
            </div>
            <PollOptionInputs options={pollOptions} onChange={setPollOptions} />
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
                      pollDuration === d ? 'bg-accent text-white shadow-sm shadow-accent/30' : 'glass text-text-secondary'
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
              {identityMode === 'anonymous' ? '🎲' : identityMode === 'alias' ? '👤' : '📛'}
              {' '}Change →
            </span>
          </button>
        ) : (
          <div className="w-full flex items-center gap-3 px-4 py-3.5 glass rounded-[var(--r-lg)]">
            <span className="text-base">🔒</span>
            <span className="text-text-secondary text-sm">World ID verification required to post</span>
          </div>
        )}

        {/* Image attachment — text post only */}
        {!isPoll && (
          <ImagePicker
            previewUrl={imageUrl}
            onUpload={setImageUrl}
            onClear={() => setImageUrl(null)}
          />
        )}

        {error && (
          <p className="text-downvote text-sm rounded-[var(--r-md)] px-4 py-3 bg-downvote/10 border border-downvote/20">
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
            (isPoll && pollOptions.filter((o) => o.trim()).length < 2)
          }
          className="w-full bg-accent disabled:opacity-30 text-white font-semibold py-4 rounded-[var(--r-lg)] transition-all active:scale-[0.98] active:bg-accent-hover text-base tracking-[-0.01em] shadow-lg shadow-accent/25"
        >
          {isSubmitting
            ? (isPoll ? 'Creating poll…' : 'Posting…')
            : (isPoll ? 'Create poll' : 'Post')}
        </button>
      </div>
    </BottomSheet>
  )
}
