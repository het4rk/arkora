'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MiniKit } from '@worldcoin/minikit-js'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useArkoraStore } from '@/store/useArkoraStore'
import { usePost } from '@/hooks/usePost'
import { generateAlias } from '@/lib/session'
import { BOARDS, ANONYMOUS_BOARDS, type BoardId } from '@/lib/types'
import { cn, haptic } from '@/lib/utils'
import { ImagePicker } from '@/components/ui/ImagePicker'
import { QuotedPost } from '@/components/ui/QuotedPost'
import { MentionSuggestions } from '@/components/ui/MentionSuggestions'
import { useMentionAutocomplete } from '@/hooks/useMentionAutocomplete'
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

  const [mode, setMode] = useState<'post' | 'poll'>('post')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [boardId, setBoardId] = useState<BoardId>('arkora')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [pollOptions, setPollOptions] = useState<string[]>(['', ''])
  const [pollDuration, setPollDuration] = useState<24 | 72 | 168>(72)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const mention = useMentionAutocomplete(body)

  // Ensure alias exists when mode is selected
  useEffect(() => {
    if (identityMode === 'alias' && nullifierHash && !persistentAlias) {
      setPersistentAlias(generateAlias(nullifierHash))
    }
  }, [identityMode, nullifierHash, persistentAlias, setPersistentAlias])

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

  async function handleSubmit() {
    if (!title.trim()) return
    if (mode === 'post' && !body.trim()) return
    if (mode === 'poll' && pollOptions.filter((o) => o.trim()).length < 2) return

    // Attach GPS coords when location sharing is enabled
    let lat: number | undefined
    let lng: number | undefined
    if (locationEnabled && typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5_000, enableHighAccuracy: false })
        )
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch {
        // Silent fail — post still goes through without location
      }
    }

    const post = await submit({
      title,
      body: mode === 'poll' ? '' : body,
      boardId,
      pseudoHandle: getPseudoHandle(),
      imageUrl: mode === 'poll' ? undefined : (imageUrl ?? undefined),
      quotedPostId: composerQuotedPost?.id ?? undefined,
      lat,
      lng,
      ...(mode === 'poll' && {
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
      setMode('post')
      setComposerQuotedPost(null)
      setComposerOpen(false)
      router.push(`/post/${post.id}`)
    }
  }

  if (!isComposerOpen) return null

  const isPoll = mode === 'poll'

  return (
    <BottomSheet
      isOpen={isComposerOpen}
      onClose={() => { setComposerOpen(false); setComposerQuotedPost(null) }}
      title={composerQuotedPost ? 'Quote post' : 'New post'}
    >
      <div className="space-y-5">

        {/* Post / Poll mode toggle — hidden when quoting */}
        {!composerQuotedPost && (
          <div className="flex items-center gap-1 p-1 glass rounded-[var(--r-full)]">
            {(['post', 'poll'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { haptic('light'); setMode(m) }}
                className={cn(
                  'flex-1 py-2 rounded-[var(--r-full)] text-sm font-semibold transition-all',
                  mode === m ? 'bg-accent text-white shadow-sm' : 'text-text-muted'
                )}
              >
                {m === 'post' ? 'Post' : 'Poll'}
              </button>
            ))}
          </div>
        )}

        {/* Board selector */}
        <div>
          <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em] mb-3">Board</p>
          <div className="flex flex-wrap gap-2">
            {BOARDS.map((board) => (
              <button
                key={board.id}
                onClick={() => setBoardId(board.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--r-full)] text-sm font-medium transition-all active:scale-95',
                  boardId === board.id
                    ? 'bg-accent text-white shadow-sm shadow-accent/30'
                    : 'glass text-text-secondary'
                )}
              >
                <span className="text-xs">{board.emoji}</span>
                <span>#{board.label}</span>
              </button>
            ))}
          </div>
          {/* Anonymity notice for confession-style boards */}
          {ANONYMOUS_BOARDS.has(boardId) && (
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

        {/* Body (post mode) or Poll options */}
        {!isPoll ? (
          <div>
            <label htmlFor="post-body" className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em] mb-2 block">Body</label>
            <div className="relative">
              <textarea
                id="post-body"
                ref={bodyRef}
                value={body}
                onChange={(e) => {
                  const val = e.target.value.slice(0, 10000)
                  setBody(val)
                  mention.onTextChange(val, e.target.selectionStart ?? val.length)
                }}
                onKeyDown={(e) => {
                  if (!mention.isOpen) return
                  if (e.key === 'ArrowDown') { e.preventDefault(); mention.setActiveIndex(Math.min(mention.activeIndex + 1, mention.suggestions.length - 1)) }
                  if (e.key === 'ArrowUp') { e.preventDefault(); mention.setActiveIndex(Math.max(mention.activeIndex - 1, 0)) }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    const s = mention.suggestions[mention.activeIndex]
                    if (s?.pseudoHandle) { e.preventDefault(); setBody(mention.selectSuggestion(s.pseudoHandle)) }
                  }
                  if (e.key === 'Escape') mention.close()
                }}
                placeholder="Say more… (type @handle to mention)"
                rows={4}
                className="glass-input w-full rounded-[var(--r-lg)] px-4 py-3.5 text-base resize-none leading-relaxed"
              />
              {mention.isOpen && (
                <MentionSuggestions
                  suggestions={mention.suggestions}
                  activeIndex={mention.activeIndex}
                  onSelect={(handle) => { setBody(mention.selectSuggestion(handle)); bodyRef.current?.focus() }}
                  onHover={mention.setActiveIndex}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em]">Options</p>
            <PollOptionInputs options={pollOptions} onChange={setPollOptions} />
            <div>
              <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em] mb-2">Duration</p>
              <div className="flex gap-2">
                {([24, 72, 168] as const).map((d) => (
                  <button
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

        {/* Identity row — tappable for verified; lock notice for guests */}
        {isVerified ? (
          <button
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

        {/* Image attachment — post mode only */}
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
          onClick={() => { haptic('medium'); void handleSubmit() }}
          disabled={
            isSubmitting ||
            !title.trim() ||
            (!isPoll && !body.trim()) ||
            (isPoll && pollOptions.filter((o) => o.trim()).length < 2)
          }
          className="w-full bg-accent disabled:opacity-30 text-white font-semibold py-4 rounded-[var(--r-lg)] transition-all active:scale-[0.98] active:bg-accent-hover text-base tracking-[-0.01em] shadow-lg shadow-accent/25"
        >
          {isSubmitting ? (isPoll ? 'Creating poll…' : 'Posting…') : (isPoll ? 'Create poll' : 'Post')}
        </button>
      </div>
    </BottomSheet>
  )
}
