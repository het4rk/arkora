'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Reply } from '@/lib/types'
import { TimeAgo } from '@/components/ui/TimeAgo'
import { haptic } from '@/lib/utils'
import { useArkoraStore } from '@/store/useArkoraStore'

interface Props {
  reply: Reply & { postTitle: string | null }
  onDeleted?: (replyId: string) => void
}

export function ProfileReplyCard({ reply, onDeleted }: Props) {
  const router = useRouter()
  const { nullifierHash } = useArkoraStore()
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!nullifierHash || isDeleting) return
    haptic('medium')
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/replies/${reply.id}`, {
        method: 'DELETE',
      })
      if (res.ok) onDeleted?.(reply.id)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div
      className="glass rounded-[var(--r-lg)] p-4 space-y-2.5 active:scale-[0.99] transition-transform cursor-pointer"
      onClick={() => router.push(`/post/${reply.postId}`)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="text-accent shrink-0">
            <polyline points="9 17 4 12 9 7" />
            <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
          </svg>
          <span className="text-accent text-[11px] font-medium truncate">
            {reply.postTitle ?? 'thread'}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
          <TimeAgo date={reply.createdAt} />
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label="Delete reply"
            className="text-text-muted/40 hover:text-downvote active:scale-90 transition-all disabled:opacity-30"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      </div>

      <p className="text-text-secondary text-sm leading-relaxed line-clamp-3">
        {reply.body}
      </p>
    </div>
  )
}
