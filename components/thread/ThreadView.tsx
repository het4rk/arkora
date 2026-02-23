'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Post, Reply, CommunityNote } from '@/lib/types'
import { HumanBadge } from '@/components/ui/HumanBadge'
import { BoardTag } from '@/components/ui/BoardTag'
import { VoteButtons } from '@/components/ui/VoteButtons'
import { TimeAgo } from '@/components/ui/TimeAgo'
import { ReplyCard } from './ReplyCard'
import { ReplyComposer } from './ReplyComposer'

interface ThreadData {
  post: Post
  replies: Reply[]
  notes: CommunityNote[]
}

interface Props {
  postId: string
}

export function ThreadView({ postId }: Props) {
  const router = useRouter()
  const [data, setData] = useState<ThreadData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchThread = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts/${postId}`)
      if (!res.ok) {
        if (res.status === 404) { router.replace('/'); return }
        throw new Error('Failed to fetch thread')
      }
      const json = (await res.json()) as { success: boolean; data: ThreadData }
      setData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [postId, router])

  useEffect(() => { void fetchThread() }, [fetchThread])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-5 animate-pulse space-y-4">
        <div className="h-5 w-24 bg-surface-up rounded-full" />
        <div className="h-8 w-full bg-surface-up rounded-xl" />
        <div className="h-8 w-3/4 bg-surface-up rounded-xl" />
        <div className="h-6 w-32 bg-surface-up rounded-full" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-text-secondary">
        {error ?? 'Post not found'}
      </div>
    )
  }

  const { post, replies, notes } = data
  const promotedNote = notes.find((n) => n.isPromoted)
  const displayName = post.pseudoHandle ?? post.sessionTag

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-32">
        {/* Back */}
        <div className="px-4 pt-4 pb-2">
          <button
            onClick={() => router.back()}
            className="text-text-muted text-sm flex items-center gap-1"
          >
            ← Back
          </button>
        </div>

        {/* Post */}
        <article className="px-4 py-4 border-b border-border space-y-4">
          <BoardTag boardId={post.boardId} />

          <h1 className="text-text text-2xl font-bold leading-tight">
            {post.title}
          </h1>

          <HumanBadge label={displayName} size="md" />

          <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-wrap">
            {post.body}
          </p>

          {/* Community Note */}
          {promotedNote && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
              <p className="text-amber-400 text-xs font-semibold mb-2">
                📝 Community Note
              </p>
              <p className="text-text-secondary text-sm leading-relaxed">
                {promotedNote.body}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <VoteButtons post={post} />
            <TimeAgo date={post.createdAt} />
          </div>
        </article>

        {/* Replies */}
        <div className="px-4 py-4 space-y-3">
          <h2 className="text-text-secondary text-xs font-semibold uppercase tracking-wide">
            {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
          </h2>

          {replies.map((reply, i) => (
            <ReplyCard key={reply.id} reply={reply} isTopReply={i === 0} />
          ))}

          {replies.length === 0 && (
            <p className="text-text-muted text-sm text-center py-8">
              No replies yet. Be the first.
            </p>
          )}
        </div>
      </div>

      {/* Fixed reply composer */}
      <div className="fixed bottom-0 left-0 right-0 z-20">
        <ReplyComposer postId={postId} onSuccess={() => void fetchThread()} />
      </div>
    </div>
  )
}
