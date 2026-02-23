'use client'

import { useState } from 'react'
import type { Reply } from '@/lib/types'
import { HumanBadge } from '@/components/ui/HumanBadge'
import { TimeAgo } from '@/components/ui/TimeAgo'
import { useArkoraStore } from '@/store/useArkoraStore'
import { haptic } from '@/lib/utils'

interface Props {
  reply: Reply
  isTopReply?: boolean | undefined
  onReplyTo?: ((reply: Reply) => void) | undefined
  onDeleted?: (() => void) | undefined
}

export function ReplyCard({ reply, isTopReply, onReplyTo, onDeleted }: Props) {
  const { nullifierHash } = useArkoraStore()
  const [isDeleting, setIsDeleting] = useState(false)
  const isOwner = !!nullifierHash && reply.nullifierHash === nullifierHash
  const isDeleted = !!reply.deletedAt

  const displayName = isDeleted ? 'deleted' : (reply.pseudoHandle ?? reply.sessionTag)

  async function handleDelete() {
    if (!nullifierHash || isDeleting) return
    haptic('medium')
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/replies/${reply.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nullifierHash }),
      })
      if (res.ok) {
        onDeleted?.()
      }
    } finally {
      setIsDeleting(false)
    }
  }

  if (isDeleted) {
    return (
      <div className="glass rounded-[var(--r-lg)] p-4 opacity-50">
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-xs italic">[deleted]</span>
          <TimeAgo date={reply.createdAt} />
        </div>
      </div>
    )
  }

  return (
    <div className="glass rounded-[var(--r-lg)] p-4 space-y-3">
      {/* Top row */}
      <div className="flex items-center justify-between">
        <HumanBadge label={displayName} size="sm" />
        <div className="flex items-center gap-2.5">
          {isTopReply && (
            <span className="text-[10px] text-accent font-bold uppercase tracking-[0.10em]">
              Top
            </span>
          )}
          <TimeAgo date={reply.createdAt} />
          {isOwner && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              aria-label="Delete reply"
              className="text-text-muted/50 hover:text-downvote active:scale-90 transition-all disabled:opacity-30"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-wrap">
        {reply.body}
      </p>

      {/* Reply image */}
      {reply.imageUrl && (
        <div className="rounded-[var(--r-md)] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={reply.imageUrl}
            alt=""
            className="w-full max-h-72 object-contain bg-surface-up"
            loading="lazy"
          />
        </div>
      )}

      {/* Actions row */}
      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 text-text-muted text-xs">
          <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor" className="text-upvote/70">
            <path d="M6 1L11.196 9.5H0.804L6 1Z" />
          </svg>
          {reply.upvotes}
        </span>
        <span className="flex items-center gap-1 text-text-muted text-xs">
          <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor" className="text-downvote/70">
            <path d="M6 11L0.804 2.5H11.196L6 11Z" />
          </svg>
          {reply.downvotes}
        </span>
        </div>

        {onReplyTo && (
          <button
            onClick={() => onReplyTo(reply)}
            className="flex items-center gap-1 text-text-muted text-xs active:opacity-60 transition-opacity"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 17 4 12 9 7" />
              <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
            </svg>
            Reply
          </button>
        )}
      </div>
    </div>
  )
}
