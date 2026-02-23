'use client'

import type { Reply } from '@/lib/types'
import { HumanBadge } from '@/components/ui/HumanBadge'
import { TimeAgo } from '@/components/ui/TimeAgo'

interface Props {
  reply: Reply
  isTopReply?: boolean
}

export function ReplyCard({ reply, isTopReply }: Props) {
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

      {/* Vote indicators */}
      <div className="flex items-center gap-3 pt-0.5">
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
    </div>
  )
}
