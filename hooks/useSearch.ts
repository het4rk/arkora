'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { Post } from '@/lib/types'

interface UseSearchReturn {
  query: string
  setQuery: (q: string) => void
  results: Post[]
  isSearching: boolean
  hasSearched: boolean
  clear: () => void
}

export function useSearch(): UseSearchReturn {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Post[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(async (q: string) => {
    setIsSearching(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=30`)
      const json = (await res.json()) as { success: boolean; data: Post[] }
      setResults(json.success ? json.data : [])
      setHasSearched(true)
    } catch {
      setResults([])
      setHasSearched(true)
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim()) {
      setResults([])
      setHasSearched(false)
      return
    }

    // 350ms debounce - fast enough to feel instant, slow enough to batch keystrokes
    debounceRef.current = setTimeout(() => {
      void runSearch(query.trim())
    }, 350)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, runSearch])

  const clear = useCallback(() => {
    setQuery('')
    setResults([])
    setHasSearched(false)
  }, [])

  return { query, setQuery, results, isSearching, hasSearched, clear }
}
