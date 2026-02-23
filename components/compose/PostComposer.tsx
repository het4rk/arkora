'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MiniKit } from '@worldcoin/minikit-js'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useArkoraStore, type IdentityMode } from '@/store/useArkoraStore'
import { usePost } from '@/hooks/usePost'
import { generateAlias } from '@/lib/session'
import { BOARDS, type BoardId } from '@/lib/types'
import { cn } from '@/lib/utils'

const IDENTITY_OPTIONS: {
  mode: IdentityMode
  label: string
  description: string
  icon: string
}[] = [
  { mode: 'anonymous', label: 'Random', description: 'New Human # each post', icon: '🎲' },
  { mode: 'alias', label: 'Alias', description: 'Same handle, always', icon: '👤' },
  { mode: 'named', label: 'Named', description: 'Your World ID username', icon: '📛' },
]

export function PostComposer() {
  const router = useRouter()
  const {
    isComposerOpen, setComposerOpen,
    identityMode, setIdentityMode,
    persistentAlias, setPersistentAlias,
    nullifierHash, isVerified,
    user,
  } = useArkoraStore()
  const { submit, isSubmitting, error } = usePost()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [boardId, setBoardId] = useState<BoardId>('arkora')

  // Ensure alias exists when mode is selected
  useEffect(() => {
    if (identityMode === 'alias' && nullifierHash && !persistentAlias) {
      setPersistentAlias(generateAlias(nullifierHash))
    }
  }, [identityMode, nullifierHash, persistentAlias, setPersistentAlias])

  function getPreviewName(): string {
    if (identityMode === 'alias') {
      return persistentAlias ?? (nullifierHash ? generateAlias(nullifierHash) : 'alias.pending')
    }
    if (identityMode === 'named') {
      const username = MiniKit.isInstalled() ? (MiniKit.user?.username ?? null) : null
      return username ?? user?.pseudoHandle ?? 'World ID user'
    }
    return 'Human #????'
  }

  function getPseudoHandle(): string | undefined {
    if (identityMode === 'alias') {
      return persistentAlias ?? (nullifierHash ? generateAlias(nullifierHash) : undefined)
    }
    if (identityMode === 'named') {
      const username = MiniKit.isInstalled() ? (MiniKit.user?.username ?? null) : null
      return username ?? user?.pseudoHandle ?? undefined
    }
    return undefined
  }

  async function handleSubmit() {
    if (!title.trim() || !body.trim()) return
    const post = await submit({ title, body, boardId, pseudoHandle: getPseudoHandle() })
    if (post) {
      setTitle('')
      setBody('')
      setComposerOpen(false)
      router.push(`/post/${post.id}`)
    }
  }

  if (!isComposerOpen) return null

  return (
    <BottomSheet
      isOpen={isComposerOpen}
      onClose={() => setComposerOpen(false)}
      title="New post"
    >
      <div className="space-y-5">

        {/* Board selector */}
        <div>
          <p className="text-text-muted text-[11px] font-semibold uppercase tracking-wider mb-3">Board</p>
          <div className="flex flex-wrap gap-2">
            {BOARDS.map((board) => (
              <button
                key={board.id}
                onClick={() => setBoardId(board.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95',
                  boardId === board.id
                    ? 'bg-accent text-white'
                    : 'bg-surface-up text-text-secondary border border-border'
                )}
              >
                <span className="text-xs">{board.emoji}</span>
                <span>#{board.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <p className="text-text-muted text-[11px] font-semibold uppercase tracking-wider">Title</p>
            <span className="text-text-muted text-[11px]">{title.length}/280</span>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 280))}
            placeholder="What's on your mind?"
            className="w-full bg-surface-up border border-border rounded-2xl px-4 py-3.5 text-text text-base placeholder:text-text-muted focus:outline-none focus:border-accent/60 focus:bg-surface transition-all"
          />
        </div>

        {/* Body */}
        <div>
          <p className="text-text-muted text-[11px] font-semibold uppercase tracking-wider mb-2">Body</p>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 10000))}
            placeholder="Say more…"
            rows={4}
            className="w-full bg-surface-up border border-border rounded-2xl px-4 py-3.5 text-text text-base placeholder:text-text-muted focus:outline-none focus:border-accent/60 focus:bg-surface transition-all resize-none"
          />
        </div>

        {/* Identity toggle */}
        <div>
          <p className="text-text-muted text-[11px] font-semibold uppercase tracking-wider mb-3">Post as</p>
          <div className="grid grid-cols-3 gap-2">
            {IDENTITY_OPTIONS.map((opt) => (
              <button
                key={opt.mode}
                onClick={() => {
                  if (!isVerified) {
                    useArkoraStore.getState().setVerifySheetOpen(true)
                    return
                  }
                  setIdentityMode(opt.mode)
                }}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all active:scale-95',
                  identityMode === opt.mode
                    ? 'bg-accent/15 border-accent/50 text-accent'
                    : 'bg-surface-up border-border text-text-secondary'
                )}
              >
                <span className="text-lg leading-none">{opt.icon}</span>
                <span className="text-xs font-semibold">{opt.label}</span>
                <span className="text-[10px] text-center leading-tight opacity-70">{opt.description}</span>
              </button>
            ))}
          </div>

          {/* Preview */}
          <div className="mt-3 flex items-center gap-2 px-3 py-2.5 bg-surface-up rounded-xl border border-border">
            <span className="text-text-muted text-xs">Posting as</span>
            <span className="text-accent text-xs font-semibold">{getPreviewName()} ✓</span>
          </div>
        </div>

        {error && (
          <p className="text-downvote text-sm bg-downvote/10 rounded-xl px-4 py-2.5 border border-downvote/20">
            {error}
          </p>
        )}

        <button
          onClick={() => void handleSubmit()}
          disabled={isSubmitting || !title.trim() || !body.trim()}
          className="w-full bg-accent disabled:opacity-30 text-white font-semibold py-4 rounded-2xl transition-all active:scale-[0.98] active:bg-accent-hover text-base tracking-tight"
        >
          {isSubmitting ? 'Posting…' : 'Post'}
        </button>
      </div>
    </BottomSheet>
  )
}
