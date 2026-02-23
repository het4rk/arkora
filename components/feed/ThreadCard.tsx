'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import type { Post } from '@/lib/types'
import { HumanBadge } from '@/components/ui/HumanBadge'
import { BoardTag } from '@/components/ui/BoardTag'
import { VoteButtons } from '@/components/ui/VoteButtons'
import { TimeAgo } from '@/components/ui/TimeAgo'

interface Props {
  post: Post
  topReply?: string | null
}

export function ThreadCard({ post, topReply }: Props) {
  const router = useRouter()
  const displayName = post.pseudoHandle ?? post.sessionTag

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
        <TimeAgo date={post.createdAt} />
      </div>

      {/* Hero content */}
      <div className="flex-1 flex flex-col justify-start min-h-0">
        <h2 className="text-fluid-hero font-bold text-text line-clamp-5 mb-5">
          {post.title}
        </h2>

        <HumanBadge label={displayName} size="md" />

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

        <div className="flex items-center gap-1.5 text-text-muted text-xs">
          <span className="opacity-40 text-[10px]">›</span>
          <span>
            {post.replyCount}{' '}
            {post.replyCount === 1 ? 'reply' : 'replies'}
          </span>
        </div>
      </div>
    </motion.article>
  )
}
