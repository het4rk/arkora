'use client'

import { useState, useRef, useCallback, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import type { Post, PollResult } from '@/lib/types'
import { PollCard } from '@/components/feed/PollCard'
import { HumanBadge } from '@/components/ui/HumanBadge'
import { KarmaBadge } from '@/components/ui/KarmaBadge'
import { BoardTag } from '@/components/ui/BoardTag'
import { VoteButtons } from '@/components/ui/VoteButtons'
import { TimeAgo } from '@/components/ui/TimeAgo'
import { BookmarkButton } from '@/components/ui/BookmarkButton'
import { QuotedPost } from '@/components/ui/QuotedPost'
import { ReportSheet } from '@/components/ui/ReportSheet'
import { ImageViewer } from '@/components/ui/ImageViewer'
import { useArkoraStore } from '@/store/useArkoraStore'
import { haptic, formatDisplayName } from '@/lib/utils'

interface Props {
  post: Post
  topReply?: string | null
  onDeleted?: (postId: string) => void
  isBookmarked?: boolean
  pollResults?: PollResult[] | null
  userVote?: number | null
  authorKarmaScore?: number | null
}

export const ThreadCard = memo(function ThreadCard({ post, topReply, onDeleted, isBookmarked, pollResults, userVote, authorKarmaScore }: Props) {
  const router = useRouter()
  const { nullifierHash, setComposerQuotedPost, setComposerOpen } = useArkoraStore()
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const [repostMenuOpen, setRepostMenuOpen] = useState(false)
  const [isReposting, setIsReposting] = useState(false)
  const [reposted, setReposted] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isOwner = !!nullifierHash && post.nullifierHash === nullifierHash
  const displayName = post.pseudoHandle ? formatDisplayName(post.pseudoHandle) : post.sessionTag

  const handleImageTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      haptic('medium')
      setImageViewerOpen(true)
    }, 500)
  }, [])

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  async function handleRepost() {
    if (!nullifierHash || isReposting) return
    haptic('medium')
    setIsReposting(true)
    setRepostMenuOpen(false)
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'repost', quotedPostId: post.id, boardId: post.boardId }),
      })
      if (res.ok) {
        setReposted(true)
        setTimeout(() => setReposted(false), 2000)
      }
    } catch { /* non-critical */ } finally {
      setIsReposting(false)
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!nullifierHash || isDeleting) return
    haptic('medium')
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' })
      if (res.ok) {
        onDeleted?.(post.id)
      } else {
        const json = (await res.json()) as { error?: string }
        setDeleteError(json.error ?? 'Failed to delete post')
      }
    } catch {
      setDeleteError('Failed to delete post')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
    <motion.article
      className="w-full bg-background flex flex-col px-[5vw] pt-10 pb-6 border-b border-border/20"
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
          {!isOwner && (
            <button
              onClick={(e) => { e.stopPropagation(); haptic('light'); setReportOpen(true) }}
              aria-label="Report post"
              className="text-text-muted/40 hover:text-text-muted active:scale-90 transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
            </button>
          )}
          {isOwner && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              aria-label="Delete post"
              className="text-text-muted/40 hover:text-text-muted active:scale-90 transition-all disabled:opacity-30"
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

      {/* Delete error */}
      {deleteError && (
        <p className="text-text-secondary text-xs mb-2">{deleteError}</p>
      )}

      {/* Hero content */}
      <div className="flex flex-col">
        {/* Repost header */}
        {post.type === 'repost' && (
          <p className="text-text-muted text-xs font-medium mb-3 flex items-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            Reposted by {displayName}
          </p>
        )}

        {post.type !== 'repost' && (
          <h2 className="text-fluid-hero font-bold text-text line-clamp-5 mb-5">
            {post.title}
          </h2>
        )}

        {/* Only pass nullifierHash when the user posted non-anonymously.
            Anonymous posts (pseudoHandle null) must never link to a profile. */}
        {post.type !== 'repost' && (
          <div className="flex items-center gap-2 flex-wrap">
            <HumanBadge
              label={displayName}
              nullifierHash={post.pseudoHandle ? post.nullifierHash : null}
              size="md"
            />
            {authorKarmaScore != null && <KarmaBadge score={authorKarmaScore} />}
          </div>
        )}

        {/* Poll - rendered in feed with results if available, otherwise options as preview */}
        {post.type === 'poll' && post.pollOptions && (
          <PollCard
            post={post}
            initialResults={pollResults ?? []}
            initialUserVote={userVote ?? null}
          />
        )}

        {/* Quoted post preview (also covers repost) */}
        {post.quotedPost && (
          <QuotedPost post={post.quotedPost} className="mt-4" />
        )}

        {/* Post image - tap to view card, long-press to view full-resolution */}
        {post.imageUrl && (
          <div
            className="mt-4 rounded-[var(--r-lg)] overflow-hidden cursor-pointer select-none"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => { e.stopPropagation(); handleImageTouchStart() }}
            onTouchEnd={(e) => { e.stopPropagation(); cancelLongPress() }}
            onTouchMove={(e) => { e.stopPropagation(); cancelLongPress() }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setImageViewerOpen(true) }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.imageUrl}
              alt=""
              className="w-full max-h-72 object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Top reply preview - glass card */}
        {topReply && (
          <div className="mt-5 glass rounded-[var(--r-lg)] px-4 py-4">
            <p className="text-accent text-[11px] font-semibold uppercase tracking-[0.12em] mb-2">
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
          {/* Repost / quote button */}
          <button
            onClick={(e) => { e.stopPropagation(); haptic('light'); setRepostMenuOpen(true) }}
            disabled={isReposting}
            aria-label="Repost or quote"
            className={`flex items-center gap-1 text-xs active:scale-90 transition-all disabled:opacity-40 ${reposted ? 'text-accent' : 'text-text-muted'}`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            {reposted ? <span>Reposted</span> : post.quoteCount > 0 ? <span>{post.quoteCount}</span> : null}
          </button>
          <BookmarkButton postId={post.id} {...(isBookmarked !== undefined && { initialBookmarked: isBookmarked })} />
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

    <ReportSheet
      isOpen={reportOpen}
      onClose={() => setReportOpen(false)}
      targetType="post"
      targetId={post.id}
    />
    {post.imageUrl && (
      <ImageViewer
        src={post.imageUrl}
        isOpen={imageViewerOpen}
        onClose={() => setImageViewerOpen(false)}
      />
    )}

    {/* Repost / quote action sheet */}
    <AnimatePresence>
      {repostMenuOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setRepostMenuOpen(false)}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 glass-sheet rounded-t-3xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="px-5 pt-5 pb-[max(env(safe-area-inset-bottom),20px)] space-y-3">
              <button
                onClick={() => void handleRepost()}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-[var(--r-lg)] glass active:scale-[0.97] transition-all"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="17 1 21 5 17 9" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <polyline points="7 23 3 19 7 15" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
                <div className="text-left">
                  <p className="text-text font-semibold text-sm">Repost</p>
                  <p className="text-text-muted text-xs">Share to your followers instantly</p>
                </div>
              </button>
              <button
                onClick={() => { setRepostMenuOpen(false); setComposerQuotedPost(post); setComposerOpen(true) }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-[var(--r-lg)] glass active:scale-[0.97] transition-all"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <div className="text-left">
                  <p className="text-text font-semibold text-sm">Quote</p>
                  <p className="text-text-muted text-xs">Add your own comment</p>
                </div>
              </button>
              <button
                onClick={() => setRepostMenuOpen(false)}
                className="w-full py-3 text-text-muted text-sm font-medium active:opacity-60 transition-all"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  )
})
