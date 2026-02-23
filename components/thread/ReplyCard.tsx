'use client'

import type { Reply } from '@/lib/types'
import { HumanBadge } from '@/components/ui/HumanBadge'
import { TimeAgo } from '@/components/ui/TimeAgo'

interface Props {
  reply: Reply
  isTopReply?: boolean
  onReplyTo?: (reply: Reply) => void
}

export function ReplyCard({ reply, isTopReply, onReplyTo }: Props) {
  const displayName = reply.pseudoHandle ?? reply.sessionTag

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
