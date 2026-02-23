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
    <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <HumanBadge label={displayName} size="sm" />
        <div className="flex items-center gap-2">
          {isTopReply && (
            <span className="text-xs text-accent font-medium">Top reply</span>
          )}
          <TimeAgo date={reply.createdAt} />
        </div>
      </div>

      <p className="text-text text-sm leading-relaxed whitespace-pre-wrap">
        {reply.body}
      </p>

      <div className="flex items-center gap-4 text-text-muted text-xs pt-1">
        <span className="flex items-center gap-1">
          <span className="text-upvote">▲</span> {reply.upvotes}
        </span>
        <span className="flex items-center gap-1">
          <span className="text-downvote">▼</span> {reply.downvotes}
        </span>
      </div>
    </div>
  )
}
