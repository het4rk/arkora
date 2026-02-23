'use client'

import { useEffect, useRef } from 'react'
import { useFeed } from '@/hooks/useFeed'
import { useArkoraStore } from '@/store/useArkoraStore'
import { ThreadCard } from './ThreadCard'
import { FeedSkeleton } from './FeedSkeleton'
import { PostComposer } from '@/components/compose/PostComposer'
import { VerifyHuman } from '@/components/auth/VerifyHuman'

export function Feed() {
  const { activeBoard } = useArkoraStore()
  const { posts, isLoading, isLoadingMore, hasMore, error, loadMore } = useFeed(
    activeBoard ?? undefined
  )
  const sentinelRef = useRef<HTMLDivElement>(null)

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
      <div className="overflow-y-scroll snap-y snap-mandatory h-[calc(100dvh-56px)] scroll-smooth">
        {posts.map((post) => (
          <ThreadCard key={post.id} post={post} />
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
