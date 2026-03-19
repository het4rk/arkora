'use client'

import { useState, useRef } from 'react'
import { MiniKit } from '@worldcoin/minikit-js'
import { haptic } from '@/lib/utils'
import { generateAlias } from '@/lib/session'
import { ImagePicker } from '@/components/ui/ImagePicker'
import { useArkoraStore } from '@/store/useArkoraStore'
import { useT } from '@/hooks/useT'
import { authFetch } from '@/lib/authFetch'

type ReplyMode = 'anonymous' | 'alias' | 'named'

interface Props {
  postId: string
  onSuccess: () => void
  parentReplyId?: string | undefined
  replyingToName?: string | undefined
}

export function ReplyComposer({ postId, onSuccess, parentReplyId, replyingToName }: Props) {
  const [body, setBody] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { nullifierHash, isVerified, setVerifySheetOpen, identityMode, persistentAlias, user } = useArkoraStore()
  const t = useT()

  // Per-reply identity mode - defaults to global preference, overridable inline
  const [replyMode, setReplyMode] = useState<ReplyMode>(identityMode)

  function getPseudoHandle(): string | undefined {
    if (replyMode === 'alias') {
      return persistentAlias ?? (nullifierHash ? generateAlias(nullifierHash) : undefined)
    }
    if (replyMode === 'named') {
      const username = MiniKit.isInstalled() ? (MiniKit.user?.username ?? null) : null
      return username ?? user?.pseudoHandle ?? undefined
    }
    return undefined
  }

  function getModeLabel(mode: ReplyMode): string {
    if (mode === 'anonymous') return 'Anon'
    if (mode === 'alias') return 'Alias'
    return 'Named'
  }

  function getModePreview(): string {
    if (replyMode === 'anonymous') return 'Human #????'
    if (replyMode === 'alias') return persistentAlias ?? (nullifierHash ? generateAlias(nullifierHash) : 'alias')
    const username = MiniKit.isInstalled() ? (MiniKit.user?.username ?? null) : null
    return username ?? user?.pseudoHandle ?? 'You'
  }

  async function handleSubmit() {
    if (!body.trim()) return

    if (!isVerified || !nullifierHash) {
      setError('Only verified humans can reply on Arkora. Verify with World ID to join the conversation.')
      setVerifySheetOpen(true)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await authFetch('/api/replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          body,
          pseudoHandle: getPseudoHandle(),
          imageUrl: imageUrl ?? undefined,
          parentReplyId,
          identityMode: replyMode,
        }),
      })

      const json = (await res.json()) as { success: boolean; error?: string }

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Failed to post reply')
      }

      setBody('')
      setImageUrl(null)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="glass-compose px-[5vw] pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">
      {error && (
        <p className="text-text-secondary text-xs mb-2 px-1">{error}</p>
      )}
      {replyingToName && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="text-accent shrink-0">
            <polyline points="9 17 4 12 9 7" />
            <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
          </svg>
          <span className="text-accent text-xs font-medium truncate">
            Replying to {replyingToName}
          </span>
        </div>
      )}

      {/* Inline identity mode picker */}
      {isVerified && (
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <span className="text-text-muted text-[10px] shrink-0">as</span>
          {(['anonymous', 'alias', 'named'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => { setReplyMode(mode); haptic('light') }}
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all active:scale-95 ${
                replyMode === mode
                  ? 'bg-accent text-background'
                  : 'text-text-muted/60 glass'
              }`}
            >
              {getModeLabel(mode)}
            </button>
          ))}
          <span className="text-text-muted/40 text-[10px] ml-1 truncate">{getModePreview()}</span>
        </div>
      )}

      {imageUrl === null && (
        <ImagePicker
          previewUrl={null}
          onUpload={setImageUrl}
          onClear={() => setImageUrl(null)}
          className="mb-2"
        />
      )}
      {imageUrl && (
        <ImagePicker
          previewUrl={imageUrl}
          onUpload={setImageUrl}
          onClear={() => setImageUrl(null)}
          className="mb-2"
        />
      )}
      <div className="flex items-end gap-3">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 10000))}
            placeholder={t('composer.replyPlaceholder')}
            rows={2}
            className="glass-input w-full rounded-[var(--r-md)] px-3.5 py-3 text-sm resize-none leading-relaxed max-h-40 overflow-y-auto"
          />
        </div>

        <button
          onClick={() => { haptic('medium'); void handleSubmit() }}
          disabled={isSubmitting || !body.trim()}
          className="mb-[3px] h-10 px-4 bg-accent disabled:opacity-35 text-background text-sm font-semibold rounded-[var(--r-md)] transition-all active:scale-95 active:bg-accent-hover shrink-0"
        >
          {isSubmitting ? t('composer.replying') : t('composer.reply')}
        </button>
      </div>
    </div>
  )
}
