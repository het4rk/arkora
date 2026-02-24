'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useFeed, type FeedMode } from '@/hooks/useFeed'
import { useArkoraStore } from '@/store/useArkoraStore'
import { ThreadCard } from './ThreadCard'
import { FeedSkeleton } from './FeedSkeleton'
import { PostComposer } from '@/components/compose/PostComposer'
import { VerifyHuman } from '@/components/auth/VerifyHuman'
import { haptic } from '@/lib/utils'

export function Feed() {
  const { activeBoard, nullifierHash, isVerified } = useArkoraStore()
  const [feedMode, setFeedMode] = useState<FeedMode>('forYou')
  const { posts, isLoading, isLoadingMore, hasMore, error, loadMore, removePost } = useFeed(
    activeBoard ?? undefined,
    feedMode,
    nullifierHash ?? undefined
  )
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())

  // Batch-fetch bookmark state for all visible posts in a single request
  const fetchBookmarks = useCallback((postIds: string[], userHash: string) => {
    if (postIds.length === 0 || !userHash) return
    const ids = postIds.join(',')
    void fetch(`/api/bookmarks?nullifierHash=${encodeURIComponent(userHash)}&postIds=${encodeURIComponent(ids)}`)
      .then((r) => r.json())
      .then((j: { success: boolean; data?: { bookmarkedIds: string[] } }) => {
        if (j.success && j.data) {
          setBookmarkedIds((prev) => {
            const next = new Set(prev)
            j.data!.bookmarkedIds.forEach((id) => next.add(id))
            return next
          })
        }
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    if (!nullifierHash || posts.length === 0) return
    fetchBookmarks(posts.map((p) => p.id), nullifierHash)
  }, [posts, nullifierHash, fetchBookmarks])

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting && hasMore && !isLoadingMore) {
          void loadMore()
        }
      },
      { threshold: 0.5 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, loadMore])

  if (isLoading) {
    return (
      <div className="h-screen">
        <FeedSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center text-text-secondary px-6 text-center">
        <div>
          <p className="text-2xl mb-2">⚡</p>
          <p className="font-semibold text-text mb-1">Failed to load feed</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center text-text-secondary px-6 text-center">
        <div>
          <p className="text-4xl mb-4">🌐</p>
          <p className="font-bold text-text text-xl mb-2">No posts yet</p>
          <p className="text-sm">Be the first verified human to post.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Feed mode toggle — floats over the snap feed */}
      {isVerified && (
        <div className="fixed top-[max(env(safe-area-inset-top),12px)] left-1/2 -translate-x-1/2 z-20 flex items-center glass rounded-full px-1 py-1 gap-0.5 shadow-lg">
          {(['forYou', 'following'] as FeedMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => { haptic('light'); setFeedMode(mode) }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                feedMode === mode
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-muted'
              }`}
            >
              {mode === 'forYou' ? 'For You' : 'Following'}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-y-scroll snap-y snap-mandatory h-[calc(100dvh-56px)] scroll-smooth">
        {feedMode === 'following' && !isLoading && posts.length === 0 && (
          <div className="h-[calc(100dvh-56px)] flex items-center justify-center text-text-secondary px-6 text-center">
            <div>
              <p className="text-3xl mb-4">👥</p>
              <p className="font-bold text-text text-lg mb-2">No posts yet</p>
              <p className="text-sm">Follow people to see their posts here.</p>
            </div>
          </div>
        )}
        {posts.map((post) => (
          <ThreadCard key={post.id} post={post} onDeleted={removePost} isBookmarked={bookmarkedIds.has(post.id)} />
        ))}

        {/* Infinite scroll sentinel */}
        {hasMore && (
          <div ref={sentinelRef} className="h-screen flex items-center justify-center">
            {isLoadingMore && <FeedSkeleton />}
          </div>
        )}

        {!hasMore && posts.length > 0 && (
          <div className="h-screen flex items-center justify-center text-text-muted text-sm">
            You&apos;ve seen it all.
          </div>
        )}
      </div>

      <PostComposer />
      <VerifyHuman />
    </>
  )
}
