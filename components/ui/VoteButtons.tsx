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

  // Optimistic display
  const displayUpvotes =
    myDirection === 1 && post.upvotes === 0 ? 1 : post.upvotes
  const displayDownvotes =
    myDirection === -1 && post.downvotes === 0 ? 1 : post.downvotes

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <button
        onClick={() => void castVote(post.id, 1)}
        disabled={isVoting}
        className={cn(
          'flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full transition-all active:scale-95',
          myDirection === 1
            ? 'bg-upvote/20 text-upvote border border-upvote/40'
            : 'bg-surface-up text-text-secondary border border-border hover:border-upvote/40 hover:text-upvote'
        )}
        aria-label="Upvote"
      >
        <span>▲</span>
        <span>{displayUpvotes}</span>
      </button>

      <button
        onClick={() => void castVote(post.id, -1)}
        disabled={isVoting}
        className={cn(
          'flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full transition-all active:scale-95',
          myDirection === -1
            ? 'bg-downvote/20 text-downvote border border-downvote/40'
            : 'bg-surface-up text-text-secondary border border-border hover:border-downvote/40 hover:text-downvote'
        )}
        aria-label="Downvote"
      >
        <span>▼</span>
        <span>{displayDownvotes}</span>
      </button>
    </div>
  )
}
