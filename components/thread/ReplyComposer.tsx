'use client'

import { useState } from 'react'
import { haptic } from '@/lib/utils'
import { useArkoraStore } from '@/store/useArkoraStore'
import { HumanBadge } from '@/components/ui/HumanBadge'

interface Props {
  postId: string
  onSuccess: () => void
}

export function ReplyComposer({ postId, onSuccess }: Props) {
  const [body, setBody] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { nullifierHash, isVerified, setVerifySheetOpen } = useArkoraStore()

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
        body: JSON.stringify({ postId, body, nullifierHash }),
      })

      const json = (await res.json()) as { success: boolean; error?: string }

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Failed to post reply')
      }

      setBody('')
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
