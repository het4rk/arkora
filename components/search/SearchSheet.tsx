'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useSearch } from '@/hooks/useSearch'
import { useArkoraStore } from '@/store/useArkoraStore'
import { BoardTag } from '@/components/ui/BoardTag'
import { TimeAgo } from '@/components/ui/TimeAgo'
import { BOARDS } from '@/lib/types'
import type { SearchFilter, BoardResult, PersonResult, Post } from '@/lib/types'

const FILTERS: { key: SearchFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'boards', label: 'Boards' },
  { key: 'people', label: 'People' },
  { key: 'posts', label: 'Posts' },
]

function karmaRank(score: number): string {
  if (score >= 500) return 'Elder'
  if (score >= 100) return 'Trusted'
  if (score >= 10) return 'Contributor'
  return 'Newcomer'
}

export function SearchSheet() {
  const { isSearchOpen, setSearchOpen, setActiveBoard } = useArkoraStore()
  const { query, setQuery, filter, setFilter, results, isSearching, hasSearched, clear } = useSearch()
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

  function handleSelectPost(postId: string) {
    setSearchOpen(false)
    router.push(`/post/${postId}`)
  }

  function handleSelectBoard(boardId: string) {
    setSearchOpen(false)
    setActiveBoard(boardId)
    router.push('/')
  }

  function handleSelectPerson(handle: string) {
    setQuery(handle)
    setFilter('posts')
  }

  const hasBoards = results.boards.length > 0
  const hasPeople = results.people.length > 0
  const hasPosts = results.posts.length > 0
  const hasAnyResults = hasBoards || hasPeople || hasPosts

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
            {/* Search bar + filter chips */}
            <div className="px-5 pt-[max(env(safe-area-inset-top),20px)] pb-3 border-b border-white/[0.07]">
              <div className="flex items-center gap-3">
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
                  placeholder="Search posts, boards, people..."
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

              {/* Filter chips */}
              <div className="flex gap-2 mt-3">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                      filter === f.key
                        ? 'bg-accent text-background'
                        : 'glass text-text-secondary'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
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

              {!isSearching && hasSearched && !hasAnyResults && (
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

              {/* Empty state: featured boards */}
              {!isSearching && !hasSearched && !query && (
                <div className="px-5 py-6">
                  <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em] mb-4">
                    Boards
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {BOARDS.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => handleSelectBoard(b.id)}
                        className="glass px-3 py-2 rounded-[var(--r-full)] text-sm text-text-secondary font-medium active:scale-95 transition-all"
                      >
                        #{b.id}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Grouped results */}
              {!isSearching && hasAnyResults && (
                <div>
                  {hasBoards && (
                    <BoardsSection
                      boards={results.boards}
                      onSelect={handleSelectBoard}
                      showSeeAll={filter === 'all' && results.boards.length >= 5}
                      onSeeAll={() => setFilter('boards')}
                    />
                  )}

                  {hasPeople && (
                    <PeopleSection
                      people={results.people}
                      onSelect={handleSelectPerson}
                      showSeeAll={filter === 'all' && results.people.length >= 5}
                      onSeeAll={() => setFilter('people')}
                    />
                  )}

                  {hasPosts && (
                    <PostsSection
                      posts={results.posts}
                      onSelect={handleSelectPost}
                      showSeeAll={filter === 'all' && results.posts.length >= 10}
                      onSeeAll={() => setFilter('posts')}
                    />
                  )}
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

// ── Section Components ─────────────────────────────────────────────────────

function SectionHeader({ title, showSeeAll, onSeeAll }: { title: string; showSeeAll: boolean; onSeeAll: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <p className="text-text-muted text-[11px] font-semibold uppercase tracking-[0.12em]">
        {title}
      </p>
      {showSeeAll && (
        <button onClick={onSeeAll} className="text-accent text-xs font-semibold active:opacity-60">
          See all
        </button>
      )}
    </div>
  )
}

function BoardsSection({ boards, onSelect, showSeeAll, onSeeAll }: {
  boards: BoardResult[]
  onSelect: (id: string) => void
  showSeeAll: boolean
  onSeeAll: () => void
}) {
  return (
    <div className="border-b border-white/[0.05]">
      <SectionHeader title="Boards" showSeeAll={showSeeAll} onSeeAll={onSeeAll} />
      <div className="px-5 pb-4 flex flex-wrap gap-2">
        {boards.map((b) => (
          <button
            key={b.id}
            onClick={() => onSelect(b.id)}
            className="glass flex items-center gap-2 px-3 py-2 rounded-full active:scale-95 transition-all"
          >
            <span className="text-sm text-text font-medium">#{b.id}</span>
            <span className="text-[11px] text-text-muted">{b.postCount}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function PeopleSection({ people, onSelect, showSeeAll, onSeeAll }: {
  people: PersonResult[]
  onSelect: (handle: string) => void
  showSeeAll: boolean
  onSeeAll: () => void
}) {
  return (
    <div className="border-b border-white/[0.05]">
      <SectionHeader title="People" showSeeAll={showSeeAll} onSeeAll={onSeeAll} />
      <div className="divide-y divide-white/[0.05]">
        {people.map((p) => (
          <button
            key={p.nullifierHash}
            onClick={() => onSelect(p.pseudoHandle)}
            className="w-full text-left px-5 py-3 flex items-center gap-3 active:bg-white/[0.04] transition-colors"
          >
            {p.avatarUrl ? (
              <img
                src={p.avatarUrl}
                alt={p.pseudoHandle}
                className="w-9 h-9 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-surface-up flex items-center justify-center shrink-0">
                <span className="text-text-muted text-sm font-bold">
                  {p.pseudoHandle.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-text text-sm font-semibold truncate">@{p.pseudoHandle}</p>
              <p className="text-text-muted text-xs">{karmaRank(p.karmaScore)} - {p.karmaScore} karma</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function PostsSection({ posts, onSelect, showSeeAll, onSeeAll }: {
  posts: Post[]
  onSelect: (id: string) => void
  showSeeAll: boolean
  onSeeAll: () => void
}) {
  return (
    <div>
      <SectionHeader title="Posts" showSeeAll={showSeeAll} onSeeAll={onSeeAll} />
      <div className="divide-y divide-white/[0.05]">
        {posts.map((post) => (
          <button
            key={post.id}
            onClick={() => onSelect(post.id)}
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
              {post.pseudoHandle ? `@${post.pseudoHandle}` : post.sessionTag}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
