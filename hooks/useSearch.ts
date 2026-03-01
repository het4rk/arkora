'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { SearchResults, SearchFilter } from '@/lib/types'

const EMPTY: SearchResults = { boards: [], people: [], posts: [] }

interface UseSearchReturn {
  query: string
  setQuery: (q: string) => void
  filter: SearchFilter
  setFilter: (f: SearchFilter) => void
  results: SearchResults
  isSearching: boolean
  hasSearched: boolean
  clear: () => void
}

export function useSearch(): UseSearchReturn {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<SearchFilter>('all')
  const [results, setResults] = useState<SearchResults>(EMPTY)
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(async (q: string, type: SearchFilter) => {
    setIsSearching(true)
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&type=${type}`
      )
      const json = (await res.json()) as { success: boolean; data: SearchResults }
      setResults(json.success ? json.data : EMPTY)
      setHasSearched(true)
    } catch {
      setResults(EMPTY)
      setHasSearched(true)
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Re-search when query or filter changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim()) {
      setResults(EMPTY)
      setHasSearched(false)
      return
    }

    // 350ms debounce - fast enough to feel instant, slow enough to batch keystrokes
    debounceRef.current = setTimeout(() => {
      void runSearch(query.trim(), filter)
    }, 350)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, filter, runSearch])

  const clear = useCallback(() => {
    setQuery('')
    setFilter('all')
    setResults(EMPTY)
    setHasSearched(false)
  }, [])

  return { query, setQuery, filter, setFilter, results, isSearching, hasSearched, clear }
}
