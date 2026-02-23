'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Post, CommunityNote } from '@/lib/types'
import { HumanBadge } from '@/components/ui/HumanBadge'
import { BoardTag } from '@/components/ui/BoardTag'
import { VoteButtons } from '@/components/ui/VoteButtons'
import { TimeAgo } from '@/components/ui/TimeAgo'
import { ReplyTree } from './ReplyTree'
import { ReplyComposer } from './ReplyComposer'
import type { Reply } from '@/lib/types'

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
  const [replyingTo, setReplyingTo] = useState<Reply | null>(null)

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
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Scrollable content — pb must clear the fixed composer (which covers the nav bar) */}
      <div className="flex-1 overflow-y-auto pb-72">

        {/* Back button */}
        <div className="px-[5vw] pt-5 pb-2">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-text-muted text-sm font-medium active:opacity-60 transition-opacity"
          >
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 1L1 6l5 5" />
            </svg>
            Back
          </button>
        </div>

        {/* Post */}
        <article className="px-[5vw] py-5 space-y-5 border-b border-border/30">
          <div className="flex items-center justify-between">
            <BoardTag boardId={post.boardId} />
            <TimeAgo date={post.createdAt} />
          </div>

          <h1 className="text-fluid-title font-bold text-text">
            {post.title}
          </h1>

          <HumanBadge label={displayName} size="md" />

          {/* Post image */}
          {post.imageUrl && (
            <div className="rounded-[var(--r-lg)] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.imageUrl}
                alt=""
                className="w-full max-h-96 object-contain bg-surface-up"
                loading="lazy"
              />
            </div>
          )}

          <p className="text-text-secondary text-[15px] leading-[1.65] whitespace-pre-wrap">
            {post.body}
          </p>

          {/* Community Note */}
          {promotedNote && (
            <div className="glass rounded-[var(--r-lg)] p-4 border-l-2 border-amber-400/60">
              <p className="text-amber-400 text-[10px] font-bold uppercase tracking-[0.12em] mb-2">
                📝 Community Note
              </p>
              <p className="text-text-secondary text-sm leading-relaxed">
                {promotedNote.body}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <VoteButtons post={post} />
            <span className="text-text-muted text-xs">
              {post.replyCount} {post.replyCount === 1 ? 'reply' : 'replies'}
            </span>
          </div>
        </article>

        {/* Replies */}
        <div className="px-[5vw] py-5 space-y-3">
          {replies.length > 0 && (
            <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em] mb-4">
              {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
            </p>
          )}

          <ReplyTree replies={replies} onReplyTo={setReplyingTo} onDeleted={() => void fetchThread()} />

          {replies.length === 0 && (
            <p className="text-text-muted text-sm text-center py-12">
              No replies yet. Be the first.
            </p>
          )}
        </div>
      </div>

      {/* Fixed reply composer — z-40 sits above BottomNav (z-30) */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <ReplyComposer
          postId={postId}
          parentReplyId={replyingTo?.id ?? undefined}
          replyingToName={replyingTo ? (replyingTo.pseudoHandle ?? replyingTo.sessionTag) : undefined}
          onSuccess={() => { setReplyingTo(null); void fetchThread() }}
        />
      </div>
    </div>
  )
}
