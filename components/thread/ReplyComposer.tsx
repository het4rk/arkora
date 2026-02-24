'use client'

import { useState } from 'react'
import { MiniKit } from '@worldcoin/minikit-js'
import { haptic } from '@/lib/utils'
import { generateAlias } from '@/lib/session'
import { ImagePicker } from '@/components/ui/ImagePicker'
import { useArkoraStore } from '@/store/useArkoraStore'
import { HumanBadge } from '@/components/ui/HumanBadge'

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

  const { nullifierHash, isVerified, setVerifySheetOpen, identityMode, persistentAlias, walletAddress, user } = useArkoraStore()

  function shortWallet(): string | undefined {
    if (!walletAddress) return undefined
    return walletAddress.slice(0, 6) + '…' + walletAddress.slice(-4)
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
    if (!body.trim()) return

    if (!isVerified || !nullifierHash) {
      setVerifySheetOpen(true)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, body, pseudoHandle: getPseudoHandle(), imageUrl: imageUrl ?? undefined, parentReplyId }),
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
        <p className="text-downvote text-xs mb-2 px-1">{error}</p>
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
        <HumanBadge size="sm" className="mb-[3px] shrink-0" />

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 10000))}
          placeholder="Add a reply…"
          rows={2}
          className="glass-input flex-1 rounded-[var(--r-md)] px-3.5 py-3 text-sm resize-none leading-relaxed"
        />

        <button
          onClick={() => { haptic('medium'); void handleSubmit() }}
          disabled={isSubmitting || !body.trim()}
          className="mb-[3px] h-10 px-4 bg-accent disabled:opacity-35 text-white text-sm font-semibold rounded-[var(--r-md)] transition-all active:scale-95 active:bg-accent-hover shrink-0"
        >
          {isSubmitting ? '…' : 'Reply'}
        </button>
      </div>
    </div>
  )
}
