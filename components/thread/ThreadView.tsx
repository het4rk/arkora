'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Post, CommunityNote } from '@/lib/types'
import { HumanBadge } from '@/components/ui/HumanBadge'
import { InlineFollowButton } from '@/components/ui/InlineFollowButton'
import { BoardTag } from '@/components/ui/BoardTag'
import { VoteButtons } from '@/components/ui/VoteButtons'
import { TimeAgo } from '@/components/ui/TimeAgo'
import { BookmarkButton } from '@/components/ui/BookmarkButton'
import { QuotedPost } from '@/components/ui/QuotedPost'
import { ReplyTree } from './ReplyTree'
import { ReplyComposer } from './ReplyComposer'
import { useArkoraStore } from '@/store/useArkoraStore'
import { haptic, formatDisplayName } from '@/lib/utils'
import type { Reply } from '@/lib/types'

interface ThreadData {
  post: Post
  replies: Reply[]
  notes: CommunityNote[]
}

function NoteCard({
  note,
  isVerified,
  onVote,
}: {
  note: CommunityNote
  isVerified: boolean
  onVote: (helpful: boolean) => void
}) {
  const [myVote, setMyVote] = useState<boolean | null>(null)
  const [helpfulVotes, setHelpfulVotes] = useState(note.helpfulVotes)
  const [notHelpfulVotes, setNotHelpfulVotes] = useState(note.notHelpfulVotes)

  function handleVote(helpful: boolean) {
    const next = myVote === helpful ? null : helpful
    const delta = next !== null ? 1 : -1
    if (helpful) setHelpfulVotes((v) => v + delta)
    else setNotHelpfulVotes((v) => v + delta)
    if (myVote !== null && myVote !== helpful) {
      // switching side — undo previous
      if (myVote) setHelpfulVotes((v) => v - 1)
      else setNotHelpfulVotes((v) => v - 1)
    }
    setMyVote(next)
    onVote(helpful)
  }

  return (
    <div className={`glass rounded-[var(--r-lg)] p-4 border-l-2 ${note.isPromoted ? 'border-amber-400/60' : 'border-border/40'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-[0.12em] mb-2 ${note.isPromoted ? 'text-amber-400' : 'text-text-muted'}`}>
        {note.isPromoted ? '📝 Community Note' : '📝 Proposed Note'}
      </p>
      <p className="text-text-secondary text-sm leading-relaxed">{note.body}</p>
      {isVerified && (
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={() => handleVote(true)}
            className={`flex items-center gap-1 text-xs transition-all active:scale-90 ${myVote === true ? 'text-upvote font-semibold' : 'text-text-muted'}`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
              <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
            Helpful {helpfulVotes > 0 && <span className="ml-0.5">{helpfulVotes}</span>}
          </button>
          <button
            onClick={() => handleVote(false)}
            className={`flex items-center gap-1 text-xs transition-all active:scale-90 ${myVote === false ? 'text-downvote font-semibold' : 'text-text-muted'}`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
              <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
            </svg>
            Not helpful {notHelpfulVotes > 0 && <span className="ml-0.5">{notHelpfulVotes}</span>}
          </button>
        </div>
      )}
    </div>
  )
}

interface Props {
  postId: string
}

export function ThreadView({ postId }: Props) {
  const router = useRouter()
  const { setComposerOpen, setComposerQuotedPost, nullifierHash, isVerified } = useArkoraStore()
  const [data, setData] = useState<ThreadData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<Reply | null>(null)
  const [replySort, setReplySort] = useState<'top' | 'newest' | 'oldest'>('top')
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteSubmitting, setNoteSubmitting] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)
  // Track votes per note: noteId -> 'helpful' | 'notHelpful' | null
  const noteVotesRef = useRef<Map<string, boolean | null>>(new Map())

  async function submitNote() {
    if (!nullifierHash || !noteDraft.trim()) return
    setNoteSubmitting(true)
    setNoteError(null)
    try {
      const res = await fetch('/api/community-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, body: noteDraft.trim() }),
      })
      const json = (await res.json()) as { success: boolean; error?: string }
      if (!json.success) throw new Error(json.error ?? 'Failed to submit note')
      setNoteOpen(false)
      setNoteDraft('')
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : 'Failed to submit note')
    } finally {
      setNoteSubmitting(false)
    }
  }

  async function voteNote(noteId: string, helpful: boolean) {
    if (!nullifierHash || !isVerified) return
    haptic('light')
    const prev = noteVotesRef.current.get(noteId) ?? null
    const next = prev === helpful ? null : helpful
    noteVotesRef.current.set(noteId, next)
    try {
      await fetch('/api/community-notes/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // next === null → toggle-off, send helpful: null to delete the vote in DB
        body: JSON.stringify({ noteId, helpful: next }),
      })
    } catch {
      noteVotesRef.current.set(noteId, prev)
    }
  }

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

  const sortedReplies = useMemo(() => {
    const sorted = [...replies]
    switch (replySort) {
      case 'newest':
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case 'oldest':
        sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        break
      case 'top':
      default:
        sorted.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes))
        break
    }
    return sorted
  }, [replies, replySort])

  const displayName = post.pseudoHandle ? formatDisplayName(post.pseudoHandle) : post.sessionTag

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

          {/* Only navigate to profile from non-anonymous posts */}
          <div className="flex items-center gap-2 flex-wrap">
            <HumanBadge
              label={displayName}
              nullifierHash={post.pseudoHandle ? post.nullifierHash : null}
              size="md"
            />
            <InlineFollowButton targetHash={post.nullifierHash} />
          </div>

          {/* Quoted post */}
          {post.quotedPost && (
            <QuotedPost post={post.quotedPost} />
          )}

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

          {/* Community Notes */}
          {notes.length > 0 && (
            <div className="space-y-2">
              {notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  isVerified={isVerified}
                  onVote={(helpful) => void voteNote(note.id, helpful)}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <VoteButtons post={post} />
            <div className="flex items-center gap-3">
              {/* Quote button */}
              <button
                onClick={() => { haptic('light'); setComposerQuotedPost(post); setComposerOpen(true) }}
                aria-label="Quote post"
                className="flex items-center gap-1 text-text-muted text-xs active:scale-90 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="17 1 21 5 17 9" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <polyline points="7 23 3 19 7 15" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
                <span>{post.quoteCount > 0 ? post.quoteCount : 'Quote'}</span>
              </button>
              {/* Community Note button — only for verified users */}
              {isVerified && (
                <button
                  onClick={() => { haptic('light'); setNoteOpen((o) => !o) }}
                  aria-label="Submit community note"
                  className={`flex items-center gap-1 text-xs active:scale-90 transition-all ${noteOpen ? 'text-amber-400' : 'text-text-muted'}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>Note</span>
                </button>
              )}
              <BookmarkButton postId={post.id} />
              <span className="text-text-muted text-xs">
                {post.replyCount} {post.replyCount === 1 ? 'reply' : 'replies'}
              </span>
            </div>
          </div>

          {/* Inline community note composer */}
          {noteOpen && (
            <div className="mt-3 space-y-2">
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value.slice(0, 500))}
                placeholder="Add context or corrections that readers should know…"
                rows={3}
                className="glass-input w-full rounded-[var(--r-md)] px-3 py-2.5 text-sm resize-none leading-relaxed"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-muted/60 flex-1">{noteDraft.length}/500</span>
                {noteError && <span className="text-downvote text-[10px]">{noteError}</span>}
                <button
                  onClick={() => { setNoteOpen(false); setNoteDraft(''); setNoteError(null) }}
                  className="px-3 py-1.5 text-xs text-text-muted glass rounded-[var(--r-md)] active:opacity-70"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void submitNote()}
                  disabled={noteSubmitting || !noteDraft.trim()}
                  className="px-3 py-1.5 text-xs font-semibold bg-amber-500 text-white rounded-[var(--r-md)] active:scale-95 transition-all disabled:opacity-40"
                >
                  {noteSubmitting ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </div>
          )}
        </article>

        {/* Replies */}
        <div className="px-[5vw] py-5 space-y-3">
          {replies.length > 0 && (
            <div className="flex items-center justify-between mb-4">
              <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em]">
                {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </p>
              <div className="flex items-center gap-1">
                {(['top', 'newest', 'oldest'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setReplySort(opt)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
                      replySort === opt
                        ? 'bg-accent/15 text-accent'
                        : 'text-text-muted active:bg-white/[0.04]'
                    }`}
                  >
                    {opt === 'top' ? 'Top' : opt === 'newest' ? 'New' : 'Old'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <ReplyTree replies={sortedReplies} onReplyTo={setReplyingTo} onDeleted={() => void fetchThread()} />

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
