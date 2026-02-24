'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MiniKit } from '@worldcoin/minikit-js'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useArkoraStore } from '@/store/useArkoraStore'
import { usePost } from '@/hooks/usePost'
import { generateAlias } from '@/lib/session'
import { BOARDS, type BoardId } from '@/lib/types'
import { cn, haptic } from '@/lib/utils'
import { ImagePicker } from '@/components/ui/ImagePicker'
import { QuotedPost } from '@/components/ui/QuotedPost'

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
  } = useArkoraStore()
  const { submit, isSubmitting, error } = usePost()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [boardId, setBoardId] = useState<BoardId>('arkora')
  const [imageUrl, setImageUrl] = useState<string | null>(null)

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
    if (!title.trim() || !body.trim()) return
    const post = await submit({
      title,
      body,
      boardId,
      pseudoHandle: getPseudoHandle(),
      imageUrl: imageUrl ?? undefined,
      quotedPostId: composerQuotedPost?.id ?? undefined,
    })
    if (post) {
      setTitle('')
      setBody('')
      setImageUrl(null)
      setComposerQuotedPost(null)
      setComposerOpen(false)
      router.push(`/post/${post.id}`)
    }
  }

  if (!isComposerOpen) return null

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
        </div>

        {/* Quoted post preview */}
        {composerQuotedPost && (
          <QuotedPost post={composerQuotedPost} interactive={false} />
        )}

        {/* Title */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em]">Title</p>
            <span className="text-text-muted/60 text-[11px] tabular-nums">{title.length}/280</span>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 280))}
            placeholder="What's on your mind?"
            className="glass-input w-full rounded-[var(--r-lg)] px-4 py-3.5 text-base"
          />
        </div>

        {/* Body */}
        <div>
          <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em] mb-2">Body</p>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 10000))}
            placeholder="Say more…"
            rows={4}
            className="glass-input w-full rounded-[var(--r-lg)] px-4 py-3.5 text-base resize-none leading-relaxed"
          />
        </div>

        {/* Identity row — tappable, opens drawer */}
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

        {/* Image attachment */}
        <ImagePicker
          previewUrl={imageUrl}
          onUpload={setImageUrl}
          onClear={() => setImageUrl(null)}
        />

        {error && (
          <p className="text-downvote text-sm rounded-[var(--r-md)] px-4 py-3 bg-downvote/10 border border-downvote/20">
            {error}
          </p>
        )}

        <button
          onClick={() => { haptic('medium'); void handleSubmit() }}
          disabled={isSubmitting || !title.trim() || !body.trim()}
          className="w-full bg-accent disabled:opacity-30 text-white font-semibold py-4 rounded-[var(--r-lg)] transition-all active:scale-[0.98] active:bg-accent-hover text-base tracking-[-0.01em] shadow-lg shadow-accent/25"
        >
          {isSubmitting ? 'Posting…' : 'Post'}
        </button>
      </div>
    </BottomSheet>
  )
}
