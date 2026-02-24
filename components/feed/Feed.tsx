'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useFeed, type FeedMode } from '@/hooks/useFeed'
import { useArkoraStore } from '@/store/useArkoraStore'
import { ThreadCard } from './ThreadCard'
import { FeedSkeleton } from './FeedSkeleton'
import { VerifyHuman } from '@/components/auth/VerifyHuman'
import { haptic } from '@/lib/utils'
import { cn } from '@/lib/utils'

// Discrete radius options in miles; -1 means "entire country"
const RADIUS_OPTIONS = [1, 5, 10, 25, 50, 100, 250, -1] as const
type RadiusOption = typeof RADIUS_OPTIONS[number]

function radiusLabel(r: RadiusOption): string {
  return r === -1 ? 'Country' : `${r} mi`
}

function radiusIndexOf(miles: number): number {
  const idx = RADIUS_OPTIONS.indexOf(miles as RadiusOption)
  return idx >= 0 ? idx : 4  // default to 50mi (index 4)
}

export function Feed() {
  const { activeBoard, nullifierHash, isVerified, locationRadius, setLocationRadius } = useArkoraStore()
  const [feedMode, setFeedMode] = useState<FeedMode>('forYou')

  // Local feed — viewer GPS coords (requested on demand)
  const [viewerCoords, setViewerCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locationDenied, setLocationDenied] = useState(false)
  const [locationRequesting, setLocationRequesting] = useState(false)

  // When switching to local tab, request geolocation
  useEffect(() => {
    if (feedMode !== 'local') return
    if (viewerCoords || locationDenied) return
    setLocationRequesting(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setViewerCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationRequesting(false)
      },
      () => {
        setLocationDenied(true)
        setLocationRequesting(false)
      },
      { timeout: 10_000, enableHighAccuracy: false }
    )
  }, [feedMode, viewerCoords, locationDenied])

  const localCoords =
    feedMode === 'local' && viewerCoords
      ? { ...viewerCoords, radiusMiles: locationRadius }
      : null

  const { posts, isLoading, isLoadingMore, hasMore, error, loadMore, removePost, refresh } = useFeed(
    activeBoard ?? undefined,
    feedMode,
    nullifierHash ?? undefined,
    localCoords
  )
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())

  // Batch-fetch bookmark state for all visible posts in a single request
  const fetchBookmarks = useCallback((postIds: string[], userHash: string) => {
    if (postIds.length === 0 || !userHash) return
    const ids = postIds.join(',')
    void fetch(`/api/bookmarks?postIds=${encodeURIComponent(ids)}`)
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

  // Refresh local feed when radius changes
  const prevRadius = useRef(locationRadius)
  useEffect(() => {
    if (feedMode === 'local' && prevRadius.current !== locationRadius && viewerCoords) {
      prevRadius.current = locationRadius
      void refresh()
    }
  }, [feedMode, locationRadius, viewerCoords, refresh])

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

  const showLocalPrompt = feedMode === 'local' && !locationRequesting && locationDenied
  const showLocalLoading = feedMode === 'local' && locationRequesting

  const hasLocalCoords = feedMode === 'local' && !!viewerCoords

  return (
    <>
      {/* Feed mode toggle — shown to all users; Following tab gated to verified */}
      <div className="fixed top-[max(env(safe-area-inset-top),12px)] left-1/2 -translate-x-1/2 z-20 flex items-center glass rounded-full px-1 py-1 gap-0.5 shadow-lg">
        {(['forYou', ...(isVerified ? ['following'] : []), 'local'] as FeedMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => { haptic('light'); setFeedMode(mode) }}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all',
              feedMode === mode ? 'bg-accent text-white shadow-sm' : 'text-text-muted'
            )}
          >
            {mode === 'forYou' ? 'Curated' : mode === 'following' ? 'Following' : '📍 Local'}
          </button>
        ))}
      </div>

      {/* Radius slider — shown below tab bar when Local is active and location granted */}
      {hasLocalCoords && (
        <div className="fixed top-[calc(max(env(safe-area-inset-top),12px)+44px)] left-1/2 -translate-x-1/2 z-20 glass rounded-full px-4 py-2 flex items-center gap-3 shadow-lg">
          <input
            type="range"
            min={0}
            max={RADIUS_OPTIONS.length - 1}
            value={radiusIndexOf(locationRadius)}
            onChange={(e) => {
              const opt = RADIUS_OPTIONS[parseInt(e.target.value)]
              if (opt !== undefined) setLocationRadius(opt)
            }}
            className="w-28 accent-[var(--accent)] cursor-pointer"
          />
          <span className="text-xs font-semibold text-accent min-w-[4.5rem] text-right tabular-nums">
            {radiusLabel(locationRadius as RadiusOption)}
          </span>
        </div>
      )}

      <div className={cn(
        'overflow-y-scroll snap-y snap-mandatory h-[calc(100dvh-56px)] scroll-smooth',
        hasLocalCoords ? 'pt-8' : ''
      )}>
        {/* Local feed: requesting location */}
        {showLocalLoading && (
          <div className="h-[calc(100dvh-56px)] flex items-center justify-center text-text-secondary px-6 text-center">
            <div>
              <p className="text-3xl mb-4 animate-pulse">📍</p>
              <p className="font-semibold text-text text-lg mb-1">Finding your location…</p>
            </div>
          </div>
        )}

        {/* Local feed: denied */}
        {showLocalPrompt && (
          <div className="h-[calc(100dvh-56px)] flex items-center justify-center text-text-secondary px-6 text-center">
            <div>
              <p className="text-3xl mb-4">🚫</p>
              <p className="font-bold text-text text-lg mb-2">Location access denied</p>
              <p className="text-sm">Allow location access in your browser settings to see nearby posts.</p>
            </div>
          </div>
        )}

        {/* Following: empty state */}
        {feedMode === 'following' && !isLoading && posts.length === 0 && (
          <div className="h-[calc(100dvh-56px)] flex items-center justify-center text-text-secondary px-6 text-center">
            <div>
              <p className="text-3xl mb-4">👥</p>
              <p className="font-bold text-text text-lg mb-2">No posts yet</p>
              <p className="text-sm">Follow people to see their posts here.</p>
            </div>
          </div>
        )}

        {/* Local: empty state (got coords, but no nearby posts) */}
        {feedMode === 'local' && viewerCoords && !isLoading && posts.length === 0 && (
          <div className="h-[calc(100dvh-56px)] flex items-center justify-center text-text-secondary px-6 text-center">
            <div>
              <p className="text-3xl mb-4">🗺️</p>
              <p className="font-bold text-text text-lg mb-2">Nothing nearby yet</p>
              <p className="text-sm">
                {locationRadius === -1
                  ? 'No posts from your country yet.'
                  : `No posts within ${locationRadius} miles. Try expanding the radius.`}
              </p>
            </div>
          </div>
        )}

        {/* Default: no posts */}
        {feedMode !== 'following' && feedMode !== 'local' && posts.length === 0 && (
          <div className="h-[calc(100dvh-56px)] flex items-center justify-center text-text-secondary px-6 text-center">
            <div>
              <p className="text-4xl mb-4">🌐</p>
              <p className="font-bold text-text text-xl mb-2">No posts yet</p>
              <p className="text-sm">Be the first verified human to post.</p>
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

      <VerifyHuman />
    </>
  )
}
