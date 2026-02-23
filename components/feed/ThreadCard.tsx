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
      className="h-[calc(100dvh-56px)] w-full flex-shrink-0 snap-start bg-background flex flex-col px-5 pt-8 pb-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      onClick={() => router.push(`/post/${post.id}`)}
    >
      {/* Meta row */}
      <div className="flex items-center justify-between mb-5">
        <BoardTag boardId={post.boardId} />
        <TimeAgo date={post.createdAt} />
      </div>

      {/* Title — hero element */}
      <div className="flex-1 flex flex-col justify-start">
        <h2 className="text-text text-[2rem] font-bold leading-[1.15] tracking-[-0.03em] line-clamp-5 mb-4">
          {post.title}
        </h2>

        <HumanBadge label={displayName} size="md" />

        {/* Top reply preview */}
        {topReply && (
          <div className="mt-5 bg-surface rounded-2xl px-4 py-3.5 border border-border/60">
            <p className="text-accent text-[10px] font-semibold uppercase tracking-wider mb-2">
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
        className="flex items-center justify-between pt-5 border-t border-border/40 mt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <VoteButtons post={post} />

        <div className="flex items-center gap-1.5 text-text-muted text-xs">
          <span className="opacity-50">›</span>
          <span>
            {post.replyCount} {post.replyCount === 1 ? 'reply' : 'replies'}
          </span>
        </div>
      </div>
    </motion.article>
  )
}
