'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import type { Post } from '@/lib/types'
import { HumanBadge } from '@/components/ui/HumanBadge'
import { BoardTag } from '@/components/ui/BoardTag'
import { VoteButtons } from '@/components/ui/VoteButtons'
import { TimeAgo } from '@/components/ui/TimeAgo'
import { BookmarkButton } from '@/components/ui/BookmarkButton'
import { QuotedPost } from '@/components/ui/QuotedPost'
import { useArkoraStore } from '@/store/useArkoraStore'
import { haptic } from '@/lib/utils'

interface Props {
  post: Post
  topReply?: string | null
  onDeleted?: (postId: string) => void
}

export function ThreadCard({ post, topReply, onDeleted }: Props) {
  const router = useRouter()
  const { nullifierHash } = useArkoraStore()
  const [isDeleting, setIsDeleting] = useState(false)
  const isOwner = !!nullifierHash && post.nullifierHash === nullifierHash
  const displayName = post.pseudoHandle ?? post.sessionTag

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!nullifierHash || isDeleting) return
    haptic('medium')
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nullifierHash }),
      })
      if (res.ok) {
        onDeleted?.(post.id)
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <motion.article
      className="h-[calc(100dvh-56px)] w-full flex-shrink-0 snap-start bg-background flex flex-col px-[5vw] pt-10 pb-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
      onClick={() => router.push(`/post/${post.id}`)}
    >
      {/* Meta row */}
      <div className="flex items-center justify-between mb-6">
        <BoardTag boardId={post.boardId} />
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <TimeAgo date={post.createdAt} />
          {isOwner && (
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
          )}
        </div>
      </div>

      {/* Hero content */}
      <div className="flex-1 flex flex-col justify-start min-h-0">
        <h2 className="text-fluid-hero font-bold text-text line-clamp-5 mb-5">
          {post.title}
        </h2>

        {/* Only pass nullifierHash when the user posted non-anonymously.
            Anonymous posts (pseudoHandle null) must never link to a profile. */}
        <HumanBadge
          label={displayName}
          nullifierHash={post.pseudoHandle ? post.nullifierHash : null}
          size="md"
        />

        {/* Quoted post preview */}
        {post.quotedPost && (
          <QuotedPost post={post.quotedPost} className="mt-4" />
        )}

        {/* Post image */}
        {post.imageUrl && (
          <div className="mt-4 rounded-[var(--r-lg)] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.imageUrl}
              alt=""
              className="w-full max-h-56 object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Top reply preview — glass card */}
        {topReply && (
          <div className="mt-5 glass rounded-[var(--r-lg)] px-4 py-4">
            <p className="text-accent text-[10px] font-bold uppercase tracking-[0.12em] mb-2">
              Top reply
            </p>
            <p className="text-text-secondary text-sm leading-relaxed line-clamp-3">
              {topReply}
            </p>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div
        className="flex items-center justify-between pt-5 border-t border-border/25 mt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <VoteButtons post={post} />

        <div className="flex items-center gap-3">
          <BookmarkButton postId={post.id} />
          <div className="flex items-center gap-1.5 text-text-muted text-xs">
            <span className="opacity-40 text-[10px]">›</span>
            <span>
              {post.replyCount}{' '}
              {post.replyCount === 1 ? 'reply' : 'replies'}
            </span>
          </div>
        </div>
      </div>
    </motion.article>
  )
}
