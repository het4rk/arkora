'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Post, BoardId } from '@/lib/types'

export type FeedMode = 'forYou' | 'following'

const FEED_LIMIT = 10

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

export function useFeed(boardId?: BoardId, feedMode: FeedMode = 'forYou', nullifierHash?: string): UseFeedReturn {
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
    setHasMore(fetched.length === FEED_LIMIT)
    if (fetched.length > 0) {
      const last = fetched[fetched.length - 1]
      if (last) cursorRef.current = new Date(last.createdAt).toISOString()
    }
  }, [])

  const fetchPosts = useCallback(
    async (reset: boolean) => {
      const params = new URLSearchParams({ limit: String(FEED_LIMIT) })
      if (boardId) params.set('boardId', boardId)
      if (!reset && cursorRef.current) params.set('cursor', cursorRef.current)
      if (feedMode === 'following' && nullifierHash) {
        params.set('feed', 'following')
        params.set('nullifierHash', nullifierHash)
      }

      const res = await fetch(`/api/posts?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch feed')

      const json = (await res.json()) as { data: Post[] }
      applyPage(json.data, reset)
    },
    [boardId, feedMode, nullifierHash, applyPage]
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
