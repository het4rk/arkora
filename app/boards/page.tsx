'use client'

import { useState, useEffect } from 'react'
import { FEATURED_BOARDS, boardLabel } from '@/lib/boards'
import { useArkoraStore } from '@/store/useArkoraStore'
import { useRouter } from 'next/navigation'

interface BoardEntry {
  id: string
  label: string
  postCount?: number
}

export default function BoardsPage() {
  const { setActiveBoard } = useArkoraStore()
  const router = useRouter()
  const [boards, setBoards] = useState<BoardEntry[]>(FEATURED_BOARDS)
  const [search, setSearch] = useState('')

  useEffect(() => {
    void fetch('/api/boards')
      .then((r) => r.json())
      .then((j: { success: boolean; data?: BoardEntry[] }) => {
        if (j.success && j.data) setBoards(j.data)
      })
      .catch(() => null)
  }, [])

  const term = search.toLowerCase().trim()
  const visible = term
    ? boards.filter(
        (b) =>
          b.label.toLowerCase().includes(term) ||
          b.id.replace(/-/g, ' ').includes(term)
      )
    : boards

  function handleSelect(boardId: string) {
    setActiveBoard(boardId)
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <h1 className="text-2xl font-bold text-text mb-1">Boards</h1>
      <p className="text-text-secondary text-sm mb-4">
        Every post from a verified human.
      </p>

      {/* Search */}
      <div className="relative mb-5">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search boards…"
          className="glass-input w-full rounded-[var(--r-full)] pl-10 pr-4 py-2.5 text-sm"
        />
      </div>

      <div className="space-y-2">
        {visible.map((board) => (
          <button
            type="button"
            key={board.id}
            onClick={() => handleSelect(board.id)}
            className="w-full flex items-center justify-between glass rounded-[var(--r-xl)] px-4 py-3.5 text-left active:scale-[0.98] transition-transform"
          >
            <div>
              <div className="text-text font-semibold text-sm">#{board.label ?? boardLabel(board.id)}</div>
              <div className="text-text-muted text-xs mt-0.5">
                {board.id === 'confessions'
                  ? 'Anonymous - completely unlinkable'
                  : board.postCount
                    ? `${board.postCount} post${board.postCount !== 1 ? 's' : ''}`
                    : 'No posts yet'}
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}

        {visible.length === 0 && (
          <div className="text-center py-12 text-text-muted text-sm">
            No boards match &ldquo;{search}&rdquo;
          </div>
        )}
      </div>
    </div>
  )
}
