'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Post, BoardId } from '@/lib/types'

export type FeedMode = 'new' | 'following' | 'local' | 'hot'

const FEED_LIMIT = 10

interface LocalCoords {
  lat: number
  lng: number
  radiusMiles: number  // -1 = entire country
}

interface UseFeedReturn {
  posts: Post[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: string | null
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  removePost: (postId: string) => void
}

export function useFeed(
  boardId?: BoardId,
  feedMode: FeedMode = 'new',
  nullifierHash?: string,
  localCoords?: LocalCoords | null
): UseFeedReturn {
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Use a ref for cursor so fetchPosts doesn't need it in its dep array,
  // eliminating the stale-closure problem and unnecessary re-creations.
  const cursorRef = useRef<string | undefined>(undefined)

  const applyPage = useCallback((fetched: Post[], reset: boolean) => {
    setPosts((prev) => (reset ? fetched : [...prev, ...fetched]))
    // Hot feed is a ranked snapshot — no pagination
    setHasMore(feedMode !== 'hot' && fetched.length === FEED_LIMIT)
    if (fetched.length > 0) {
      const last = fetched[fetched.length - 1]
      if (last) cursorRef.current = new Date(last.createdAt).toISOString()
    }
  }, [feedMode])

  const fetchPosts = useCallback(
    async (reset: boolean) => {
      const params = new URLSearchParams({ limit: String(FEED_LIMIT) })
      if (boardId) params.set('boardId', boardId)

      if (feedMode === 'following') {
        params.set('feed', 'following')
        if (!reset && cursorRef.current) params.set('cursor', cursorRef.current)
      } else if (feedMode === 'local') {
        params.set('feed', 'local')
        if (localCoords) {
          params.set('radiusMiles', String(localCoords.radiusMiles))
          if (localCoords.radiusMiles > 0) {
            params.set('lat', String(localCoords.lat))
            params.set('lng', String(localCoords.lng))
          }
        } else {
          params.set('radiusMiles', '-1')
        }
        if (!reset && cursorRef.current) params.set('cursor', cursorRef.current)
      } else if (feedMode === 'hot') {
        params.set('feed', 'hot')
        // No cursor — hot feed always returns a fresh ranked snapshot
      } else {
        if (!reset && cursorRef.current) params.set('cursor', cursorRef.current)
      }

      const res = await fetch(`/api/posts?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch feed')

      const json = (await res.json()) as { data: Post[] }
      applyPage(json.data, reset)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boardId, feedMode, nullifierHash, localCoords?.lat, localCoords?.lng, localCoords?.radiusMiles, applyPage]
  )

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    cursorRef.current = undefined
    try {
      await fetchPosts(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading feed')
    } finally {
      setIsLoading(false)
    }
  }, [fetchPosts])

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    try {
      await fetchPosts(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading more posts')
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, hasMore, fetchPosts])

  useEffect(() => {
    cursorRef.current = undefined
    setPosts([])
    setHasMore(true)
    setIsLoading(true)
    setError(null)
    void fetchPosts(true).finally(() => setIsLoading(false))
  }, [boardId, feedMode, fetchPosts])

  const removePost = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }, [])

  return { posts, isLoading, isLoadingMore, hasMore, error, loadMore, refresh, removePost }
}
