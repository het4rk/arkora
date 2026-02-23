'use client'

import { useState } from 'react'
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
    <div className="border-t border-border bg-surface px-4 py-4 safe-bottom">
      <div className="flex items-start gap-3">
        <HumanBadge size="sm" className="mt-2 shrink-0" />
        <div className="flex-1">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 10000))}
            placeholder="Add a reply…"
            rows={2}
            className="w-full bg-surface-up border border-border rounded-xl px-3 py-2.5 text-text placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none text-sm"
          />

          {error && (
            <p className="text-downvote text-xs mt-1">{error}</p>
          )}

          <div className="flex justify-end mt-2">
            <button
              onClick={() => void handleSubmit()}
              disabled={isSubmitting || !body.trim()}
              className="bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors active:scale-95"
            >
              {isSubmitting ? 'Posting…' : 'Reply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
