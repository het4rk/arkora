'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Post, BoardId } from '@/lib/types'

interface UseFeedReturn {
  posts: Post[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: string | null
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
}

export function useFeed(boardId?: BoardId): UseFeedReturn {
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
    setHasMore(fetched.length === 10)
    if (fetched.length > 0) {
      const last = fetched[fetched.length - 1]
      if (last) cursorRef.current = new Date(last.createdAt).toISOString()
    }
  }, [])

  const fetchPosts = useCallback(
    async (reset: boolean) => {
      const params = new URLSearchParams({ limit: '10' })
      if (boardId) params.set('boardId', boardId)
      if (!reset && cursorRef.current) params.set('cursor', cursorRef.current)

      const res = await fetch(`/api/posts?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch feed')

      const json = (await res.json()) as { data: Post[] }
      applyPage(json.data, reset)
    },
    [boardId, applyPage]
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
  }, [boardId, fetchPosts])

  return { posts, isLoading, isLoadingMore, hasMore, error, loadMore, refresh }
}
