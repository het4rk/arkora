'use client'

import { cn } from '@/lib/utils'
import { useVote } from '@/hooks/useVote'
import type { Post } from '@/lib/types'

interface Props {
  post: Post
  className?: string
}

export function VoteButtons({ post, className }: Props) {
  const { castVote, isVoting, myVote } = useVote()
  const myDirection = myVote(post.id)

  const displayUpvotes = myDirection === 1 && post.upvotes === 0 ? 1 : post.upvotes
  const displayDownvotes = myDirection === -1 && post.downvotes === 0 ? 1 : post.downvotes

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        onClick={() => void castVote(post.id, 1)}
        disabled={isVoting}
        className={cn(
          'flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-all active:scale-95',
          myDirection === 1
            ? 'bg-upvote text-white'
            : 'bg-surface-up text-text-muted border border-border active:border-upvote/50'
        )}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 1L11.196 9.5H0.804L6 1Z" />
        </svg>
        <span>{displayUpvotes}</span>
      </button>

      <button
        onClick={() => void castVote(post.id, -1)}
        disabled={isVoting}
        className={cn(
          'flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-all active:scale-95',
          myDirection === -1
            ? 'bg-downvote text-white'
            : 'bg-surface-up text-text-muted border border-border active:border-downvote/50'
        )}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 11L0.804 2.5H11.196L6 11Z" />
        </svg>
        <span>{displayDownvotes}</span>
      </button>
    </div>
  )
}
