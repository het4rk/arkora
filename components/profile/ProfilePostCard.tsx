'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Post } from '@/lib/types'
import { BoardTag } from '@/components/ui/BoardTag'
import { TimeAgo } from '@/components/ui/TimeAgo'
import { haptic } from '@/lib/utils'
import { useArkoraStore } from '@/store/useArkoraStore'

interface Props {
  post: Post
  onDeleted?: (postId: string) => void
}

export function ProfilePostCard({ post, onDeleted }: Props) {
  const router = useRouter()
  const { nullifierHash } = useArkoraStore()
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!nullifierHash || isDeleting) return
    haptic('medium')
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'DELETE',
      })
      if (res.ok) onDeleted?.(post.id)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div
      className="glass rounded-[var(--r-lg)] p-4 space-y-3 active:scale-[0.99] transition-transform cursor-pointer"
      onClick={() => router.push(`/post/${post.id}`)}
    >
      <div className="flex items-center justify-between">
        <BoardTag boardId={post.boardId} />
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <TimeAgo date={post.createdAt} />
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label="Delete post"
            className="text-text-muted/40 hover:text-downvote active:scale-90 transition-all disabled:opacity-30"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      </div>

      <p className="text-text font-semibold text-[15px] leading-snug line-clamp-3">
        {post.title}
      </p>

      <div className="flex items-center gap-4 text-text-muted text-xs">
        <span className="flex items-center gap-1">
          <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor" className="text-upvote/70">
            <path d="M6 1L11.196 9.5H0.804L6 1Z" />
          </svg>
          {post.upvotes}
        </span>
        <span className="flex items-center gap-1">
          <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor" className="text-downvote/70">
            <path d="M6 11L0.804 2.5H11.196L6 11Z" />
          </svg>
          {post.downvotes}
        </span>
        <span className="flex items-center gap-1 opacity-60">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {post.replyCount}
        </span>
      </div>
    </div>
  )
}
