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
      className="h-screen w-full flex-shrink-0 snap-start bg-background flex flex-col justify-between px-5 py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      onClick={() => router.push(`/post/${post.id}`)}
    >
      {/* Top section */}
      <div className="flex-1 flex flex-col gap-4 pt-2 overflow-hidden">
        <BoardTag boardId={post.boardId} />

        <div>
          <h2 className="text-text text-2xl font-bold leading-tight line-clamp-5">
            {post.title}
          </h2>
        </div>

        <HumanBadge label={displayName} size="md" />

        {/* Top reply preview */}
        {topReply && (
          <div className="bg-surface-up rounded-2xl p-4 border border-border mt-2">
            <p className="text-text-muted text-xs font-medium mb-2">
              Top reply
            </p>
            <p className="text-text-secondary text-sm leading-relaxed line-clamp-4">
              {topReply}
            </p>
          </div>
        )}
      </div>

      {/* Bottom section */}
      <div
        className="flex items-center justify-between pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <VoteButtons post={post} />

        <div className="flex items-center gap-3 text-text-muted text-xs">
          <span>
            {post.replyCount}{' '}
            {post.replyCount === 1 ? 'reply' : 'replies'}
          </span>
          <TimeAgo date={post.createdAt} />
        </div>
      </div>
    </motion.article>
  )
}
