'use client'

import { useState } from 'react'
import { cn, haptic } from '@/lib/utils'
import { useVote } from '@/hooks/useVote'
import { useArkoraStore } from '@/store/useArkoraStore'
import { VoteReactionsSheet } from '@/components/ui/VoteReactionsSheet'
import type { Post } from '@/lib/types'

interface Props {
  post: Post
  className?: string
}

export function VoteButtons({ post, className }: Props) {
  const { castVote, isVoting, myVote } = useVote()
  const { nullifierHash } = useArkoraStore()
  const myDirection = myVote(post.id)
  const isOwnPost = !!nullifierHash && post.nullifierHash === nullifierHash
  const [reactionsOpen, setReactionsOpen] = useState(false)
  const [reactionsTab, setReactionsTab] = useState<'up' | 'down'>('up')

  const displayUpvotes = myDirection === 1 && post.upvotes === 0 ? 1 : post.upvotes
  const displayDownvotes = myDirection === -1 && post.downvotes === 0 ? 1 : post.downvotes

  function openReactions(tab: 'up' | 'down', e: React.MouseEvent) {
    e.stopPropagation()
    haptic('light')
    setReactionsTab(tab)
    setReactionsOpen(true)
  }

  return (
    <>
    <div className={cn('flex items-center gap-2', className)}>
      <button
        onClick={() => { if (isOwnPost) return; haptic('light'); void castVote(post.id, 1) }}
        disabled={isVoting || isOwnPost}
        aria-label={`Upvote (${displayUpvotes})`}
        title={isOwnPost ? "Can't vote on your own post" : undefined}
        className={cn(
          'flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-all active:scale-95',
          isOwnPost
            ? 'bg-surface-up text-text-muted/30 border border-border/30 cursor-not-allowed'
            : myDirection === 1
              ? 'bg-upvote text-white'
              : 'bg-surface-up text-text-muted border border-border active:border-upvote/50'
        )}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 1L11.196 9.5H0.804L6 1Z" />
        </svg>
        <span onClick={(e) => openReactions('up', e)} className="cursor-pointer">{displayUpvotes}</span>
      </button>

      <button
        onClick={() => { if (isOwnPost) return; haptic('light'); void castVote(post.id, -1) }}
        disabled={isVoting || isOwnPost}
        aria-label={`Downvote (${displayDownvotes})`}
        title={isOwnPost ? "Can't vote on your own post" : undefined}
        className={cn(
          'flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-all active:scale-95',
          isOwnPost
            ? 'bg-surface-up text-text-muted/30 border border-border/30 cursor-not-allowed'
            : myDirection === -1
              ? 'bg-downvote text-white'
              : 'bg-surface-up text-text-muted border border-border active:border-downvote/50'
        )}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 11L0.804 2.5H11.196L6 11Z" />
        </svg>
        <span onClick={(e) => openReactions('down', e)} className="cursor-pointer">{displayDownvotes}</span>
      </button>
    </div>

    <VoteReactionsSheet
      isOpen={reactionsOpen}
      onClose={() => setReactionsOpen(false)}
      postId={post.id}
      upvoteCount={displayUpvotes}
      downvoteCount={displayDownvotes}
      initialTab={reactionsTab}
    />
    </>
  )
}
