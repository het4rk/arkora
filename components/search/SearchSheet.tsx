'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useSearch } from '@/hooks/useSearch'
import { useArkoraStore } from '@/store/useArkoraStore'
import { BoardTag } from '@/components/ui/BoardTag'
import { TimeAgo } from '@/components/ui/TimeAgo'
import { BOARDS } from '@/lib/types'

export function SearchSheet() {
  const { isSearchOpen, setSearchOpen } = useArkoraStore()
  const { query, setQuery, results, isSearching, hasSearched, clear } = useSearch()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus when opened
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 120)
    } else {
      clear()
    }
  }, [isSearchOpen, clear])

  function handleSelect(postId: string) {
    setSearchOpen(false)
    router.push(`/post/${postId}`)
  }

  return (
    <AnimatePresence>
      {isSearchOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSearchOpen(false)}
          />

          {/* Sheet */}
          <motion.div
            className="fixed top-0 left-0 right-0 z-50 glass-sheet rounded-b-3xl flex flex-col"
            style={{ maxHeight: '92dvh' }}
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Search bar */}
            <div className="px-5 pt-[max(env(safe-area-inset-top),20px)] pb-4 border-b border-white/[0.07]">
              <div className="flex items-center gap-3">
                {/* Search icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className="text-text-muted shrink-0">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>

                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search posts, boards, aliases…"
                  className="flex-1 bg-transparent text-text placeholder:text-text-muted text-base outline-none"
                />

                {query && (
                  <button
                    onClick={clear}
                    className="text-text-muted text-sm font-medium shrink-0 active:opacity-60"
                  >
                    Clear
                  </button>
                )}
                {!query && (
                  <button
                    onClick={() => setSearchOpen(false)}
                    className="text-accent text-sm font-semibold shrink-0 active:opacity-60"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
              {isSearching && (
                <div className="flex items-center justify-center py-16">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-pulse"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {!isSearching && hasSearched && results.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-text-muted">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                    className="mb-3 opacity-40">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                  <p className="text-sm">No results for &ldquo;{query}&rdquo;</p>
                </div>
              )}

              {!isSearching && !hasSearched && !query && (
                <div className="px-5 py-6">
                  <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em] mb-4">
                    Boards
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {BOARDS.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => setQuery(b.id)}
                        className="glass px-3 py-2 rounded-[var(--r-full)] text-sm text-text-secondary font-medium active:scale-95 transition-all"
                      >
                        #{b.id}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!isSearching && results.length > 0 && (
                <div className="divide-y divide-white/[0.05]">
                  <p className="px-5 py-3 text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em]">
                    {results.length} result{results.length !== 1 ? 's' : ''}
                  </p>
                  {results.map((post) => (
                    <button
                      key={post.id}
                      onClick={() => handleSelect(post.id)}
                      className="w-full text-left px-5 py-4 active:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <BoardTag boardId={post.boardId} />
                        <TimeAgo date={post.createdAt} />
                      </div>
                      <p className="text-text text-sm font-semibold leading-snug line-clamp-2 mb-1">
                        {post.title}
                      </p>
                      <p className="text-text-muted text-xs line-clamp-1">
                        {post.pseudoHandle ?? post.sessionTag}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {/* Safe-area bottom pad */}
              <div className="h-[max(env(safe-area-inset-bottom),24px)]" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
