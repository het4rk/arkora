'use client'

import { useEffect, useRef, useState, useCallback, useMemo, type TouchEvent as ReactTouchEvent } from 'react'
import { useFeed, type FeedMode } from '@/hooks/useFeed'
import { useArkoraStore } from '@/store/useArkoraStore'
import { ThreadCard } from './ThreadCard'
import { FeedSkeleton } from './FeedSkeleton'
import { LiveRoomsStrip } from './LiveRoomsStrip'
import { haptic } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { PollResult } from '@/lib/types'

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

const SWIPE_COMMIT = 40

export function Feed() {
  const { activeBoard, nullifierHash, isVerified, locationRadius, setLocationRadius } = useArkoraStore()
  const [feedMode, setFeedMode] = useState<FeedMode>('new')

  // Available tabs (Following only for verified users)
  const availableTabs = useMemo<FeedMode[]>(
    () => ['new', ...(isVerified ? ['following' as FeedMode] : []), 'local'],
    [isVerified]
  )
  const currentTabIndex = availableTabs.indexOf(feedMode)

  // Local feed - viewer GPS coords (requested on demand)
  const [viewerCoords, setViewerCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locationDenied, setLocationDenied] = useState(false)
  const [locationRequesting, setLocationRequesting] = useState(false)

  // When switching to local tab, request geolocation
  useEffect(() => {
    if (feedMode !== 'local') return
    if (viewerCoords || locationDenied) return
    setLocationRequesting(true)
    const fallbackTimer = setTimeout(() => {
      setLocationDenied(true)
      setLocationRequesting(false)
    }, 15_000)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(fallbackTimer)
        setViewerCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationRequesting(false)
      },
      () => {
        clearTimeout(fallbackTimer)
        setLocationDenied(true)
        setLocationRequesting(false)
      },
      { timeout: 10_000, enableHighAccuracy: false }
    )
    return () => clearTimeout(fallbackTimer)
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const [pollDataMap, setPollDataMap] = useState<Record<string, { results: PollResult[]; userVote: number | null }>>({})

  const fetchPollData = useCallback((pollPostIds: string[]) => {
    if (pollPostIds.length === 0) return
    const ids = pollPostIds.join(',')
    void fetch(`/api/polls/batch?postIds=${encodeURIComponent(ids)}`, { signal: AbortSignal.timeout(10000) })
      .then((r) => r.json())
      .then((j: { success: boolean; data?: Record<string, { results: PollResult[]; userVote: number | null }> }) => {
        if (j.success && j.data) {
          setPollDataMap((prev) => ({ ...prev, ...j.data! }))
        }
      })
      .catch(() => null)
  }, [])

  // ---- Touch gesture state (pull-to-refresh + horizontal tab swipe) ----
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [swipeDelta, setSwipeDelta] = useState(0)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const gestureRef = useRef<'horizontal' | 'vertical' | null>(null)
  const PULL_THRESHOLD = 80

  const handleTouchStart = useCallback((e: ReactTouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    gestureRef.current = null
  }, [])

  const handleTouchMove = useCallback((e: ReactTouchEvent) => {
    const touch = e.touches[0]
    const start = touchStartRef.current
    if (!touch || !start || isRefreshing) return

    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y

    // Determine gesture direction on first significant movement
    if (gestureRef.current === null && (Math.abs(dx) + Math.abs(dy) > 10)) {
      gestureRef.current = Math.abs(dx) > Math.abs(dy) * 1.5 ? 'horizontal' : 'vertical'
    }

    if (gestureRef.current === 'horizontal') {
      // Clamp swipe: don't allow swiping past first/last tab
      const canSwipeLeft = currentTabIndex < availableTabs.length - 1
      const canSwipeRight = currentTabIndex > 0
      if ((dx < 0 && canSwipeLeft) || (dx > 0 && canSwipeRight)) {
        setSwipeDelta(dx * 0.3)
      }
    } else if (gestureRef.current === 'vertical') {
      // Pull-to-refresh (only when scrolled to top)
      if (dy > 0 && scrollRef.current && scrollRef.current.scrollTop <= 0) {
        setPullDistance(Math.min(dy * 0.4, 120))
      }
    }
  }, [isRefreshing, currentTabIndex, availableTabs.length])

  const handleTouchEnd = useCallback(async () => {
    if (gestureRef.current === 'horizontal') {
      if (swipeDelta < -SWIPE_COMMIT && currentTabIndex < availableTabs.length - 1) {
        haptic('light')
        setFeedMode(availableTabs[currentTabIndex + 1]!)
      } else if (swipeDelta > SWIPE_COMMIT && currentTabIndex > 0) {
        haptic('light')
        setFeedMode(availableTabs[currentTabIndex - 1]!)
      }
      setSwipeDelta(0)
    } else {
      // Pull-to-refresh
      if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
        setIsRefreshing(true)
        haptic('medium')
        await refresh()
        setIsRefreshing(false)
      }
      setPullDistance(0)
    }
    touchStartRef.current = null
    gestureRef.current = null
  }, [swipeDelta, pullDistance, isRefreshing, refresh, currentTabIndex, availableTabs])

  // Batch-fetch bookmark state for all visible posts
  const fetchBookmarks = useCallback((postIds: string[], userHash: string) => {
    if (postIds.length === 0 || !userHash) return
    const ids = postIds.join(',')
    void fetch(`/api/bookmarks?postIds=${encodeURIComponent(ids)}`, { signal: AbortSignal.timeout(10000) })
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

  useEffect(() => {
    const pollPostIds = posts.filter((p) => p.type === 'poll').map((p) => p.id)
    fetchPollData(pollPostIds)
  }, [posts, fetchPollData])

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

  const showLocalPrompt = feedMode === 'local' && !locationRequesting && locationDenied
  const showLocalLoading = feedMode === 'local' && locationRequesting
  const hasLocalCoords = feedMode === 'local' && !!viewerCoords

  // Swipe visual feedback styles
  const swipeStyle = swipeDelta !== 0
    ? { transform: `translateX(${swipeDelta}px)`, opacity: 1 - Math.abs(swipeDelta) / 300 }
    : { transform: 'translateX(0)', transition: 'transform 0.2s ease-out' }

  return (
    <>
      {/* Feed mode tabs - inside TopBar row, centered */}
      <div
        style={{ top: 'env(safe-area-inset-top, 0px)' }}
        className="fixed left-1/2 -translate-x-1/2 z-30 flex items-center h-14"
      >
        <div className="flex items-center glass rounded-full px-1 py-1 gap-0.5 shadow-lg">
          {availableTabs.map((mode) => (
            <button
              key={mode}
              onClick={() => { haptic('light'); setFeedMode(mode) }}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all',
                feedMode === mode ? 'bg-accent text-background shadow-sm' : 'text-text-muted'
              )}
            >
              {mode === 'new' ? 'New' : mode === 'following' ? 'Following' : 'Local'}
            </button>
          ))}
        </div>
      </div>

      {/* Radius slider - shown below TopBar when Local is active and location granted */}
      {hasLocalCoords && (
        <div style={{ top: 'calc(env(safe-area-inset-top, 0px) + 64px)' }} className="fixed left-1/2 -translate-x-1/2 z-20 glass rounded-full px-4 py-2 flex items-center gap-3 shadow-lg">
          <input
            type="range"
            aria-label="Search radius"
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

      {/* Feed content */}
      <div
        ref={scrollRef}
        className={cn(
          'overflow-y-scroll h-[calc(100dvh-56px)] scroll-smooth',
          hasLocalCoords ? 'pt-12' : 'pt-2'
        )}
        style={swipeStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Live rooms strip - auto-refreshes every 30s */}
        <LiveRoomsStrip boardId={activeBoard ?? undefined} />

        {/* Pull-to-refresh indicator */}
        {(pullDistance > 0 || isRefreshing) && (
          <div
            className="flex items-center justify-center transition-all"
            style={{ height: isRefreshing ? 48 : pullDistance }}
          >
            <div className={cn(
              'w-6 h-6 rounded-full border-2 border-accent border-t-transparent',
              isRefreshing ? 'animate-spin' : '',
              pullDistance >= PULL_THRESHOLD ? 'opacity-100 scale-100' : 'opacity-50 scale-75'
            )}
              style={!isRefreshing ? { transform: `rotate(${pullDistance * 3}deg) scale(${pullDistance >= PULL_THRESHOLD ? 1 : 0.75})` } : undefined}
            />
          </div>
        )}

        {/* Loading skeleton (inline, not full-page replacement) */}
        {isLoading && (
          <>
            <FeedSkeleton />
            <FeedSkeleton />
            <FeedSkeleton />
          </>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="flex items-center justify-center text-text-secondary px-6 text-center py-20">
            <div>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted mb-2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              <p className="font-semibold text-text mb-1">Failed to load feed</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Local feed: requesting location */}
        {showLocalLoading && (
          <div className="flex items-center justify-center text-text-secondary px-6 text-center py-20">
            <div>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted mb-4 animate-pulse"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
              <p className="font-semibold text-text text-lg mb-1">Finding your location...</p>
            </div>
          </div>
        )}

        {/* Local feed: denied */}
        {showLocalPrompt && (
          <div className="flex items-center justify-center text-text-secondary px-6 text-center py-20">
            <div>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted mb-4"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
              <p className="font-bold text-text text-lg mb-2">Location access denied</p>
              <p className="text-sm">Allow location access in your browser settings to see nearby posts.</p>
            </div>
          </div>
        )}

        {/* Following: empty state */}
        {feedMode === 'following' && !isLoading && posts.length === 0 && (
          <div className="flex items-center justify-center text-text-secondary px-6 text-center py-20">
            <div>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted mb-4 mx-auto"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              <p className="font-bold text-text text-lg mb-2">No posts yet</p>
              <p className="text-sm">Follow people to see their posts here.</p>
            </div>
          </div>
        )}

        {/* Local: empty state (got coords, but no nearby posts) */}
        {feedMode === 'local' && viewerCoords && !isLoading && posts.length === 0 && (
          <div className="flex items-center justify-center text-text-secondary px-6 text-center py-20">
            <div>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted mb-4 mx-auto"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></svg>
              <p className="font-bold text-text text-lg mb-2">Nothing nearby yet</p>
              <p className="text-sm">
                {locationRadius === -1
                  ? 'No posts from your country yet.'
                  : `No posts within ${locationRadius} miles. Try expanding the radius.`}
              </p>
            </div>
          </div>
        )}

        {/* New feed: empty state */}
        {feedMode === 'new' && !isLoading && posts.length === 0 && (
          <div className="flex items-center justify-center text-text-secondary px-6 text-center py-20">
            <div>
              <p className="font-bold text-text text-lg mb-2">No posts yet</p>
              <p className="text-sm">Be the first verified human to post.</p>
            </div>
          </div>
        )}

        {/* Guest join CTA - shown once per session to unverified users */}
        {!isVerified && posts.length > 0 && (
          <div className="px-4 pt-4 pb-2">
            <div className="glass rounded-[var(--r-lg)] px-4 py-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-text text-sm font-semibold leading-tight">Join the conversation</p>
                <p className="text-text-muted text-xs mt-0.5">Post, reply, and vote as a verified human.</p>
              </div>
              <button
                onClick={() => useArkoraStore.getState().setVerifySheetOpen(true)}
                className="border border-accent/50 text-accent text-xs font-semibold px-3.5 py-2.5 rounded-[var(--r-md)] active:scale-95 active:opacity-70 transition-all shrink-0"
              >
                Verify
              </button>
            </div>
          </div>
        )}

        {posts.map((post) => (
          <ThreadCard
            key={post.id}
            post={post}
            onDeleted={removePost}
            isBookmarked={bookmarkedIds.has(post.id)}
            pollResults={pollDataMap[post.id]?.results ?? null}
            userVote={pollDataMap[post.id]?.userVote ?? null}
            authorKarmaScore={post.authorKarmaScore ?? null}
          />
        ))}

        {/* Infinite scroll sentinel */}
        {hasMore && (
          <div ref={sentinelRef} className="h-32 flex items-center justify-center">
            {isLoadingMore && (
              <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            )}
          </div>
        )}

        {!hasMore && posts.length > 0 && (
          <div className="py-10 flex items-center justify-center text-text-muted text-sm">
            You&apos;ve seen it all.
          </div>
        )}
      </div>
    </>
  )
}
