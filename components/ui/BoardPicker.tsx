'use client'

import { useState, useRef, useEffect } from 'react'
import { normalizeBoard, resolveBoard, boardLabel } from '@/lib/boards'
import { cn } from '@/lib/utils'

interface BoardEntry {
  id: string
  label: string
}

interface BoardPickerProps {
  selected: string
  allBoards: BoardEntry[]
  onChange: (boardId: string) => void
  className?: string
}

export function BoardPicker({ selected, allBoards, onChange, className }: BoardPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60)
  }, [open])

  const searchTerm = search.toLowerCase().trim()
  const allIds = allBoards.map((b) => b.id)

  // Text-match filter: label or slug includes the search term
  const textFiltered = searchTerm
    ? allBoards.filter(
        (b) =>
          b.label.toLowerCase().includes(searchTerm) ||
          b.id.replace(/-/g, ' ').includes(searchTerm)
      )
    : allBoards

  // Resolve where the search term would land (existing board or new slug)
  const resolved = searchTerm ? resolveBoard(search, allIds) : ''
  const resolvedIsExisting = resolved !== '' && allBoards.some((b) => b.id === resolved)
  const showCreate = searchTerm.length >= 2 && !resolvedIsExisting

  // If text search found nothing but fuzzy resolve found an existing board, show it
  let displayBoards = textFiltered
  if (searchTerm && textFiltered.length === 0 && resolvedIsExisting) {
    const match = allBoards.find((b) => b.id === resolved)
    if (match) displayBoards = [match]
  }

  function select(boardId: string) {
    onChange(boardId)
    setSearch('')
    setOpen(false)
  }

  function handleEnter() {
    if (!search.trim()) { setOpen(false); return }
    const r = resolveBoard(search, allIds)
    select(r)
  }

  const selectedLabel = allBoards.find((b) => b.id === selected)?.label ?? boardLabel(selected)

  return (
    <div className={cn('space-y-2', className)}>
      {/* Collapsed: selected chip + change button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 group"
        >
          <span className="px-3.5 py-1.5 rounded-[var(--r-full)] text-sm font-semibold bg-accent text-background">
            #{selectedLabel}
          </span>
          <span className="text-text-muted text-xs group-active:opacity-60 transition-opacity">
            change
          </span>
        </button>
      )}

      {/* Expanded: search + scrollable grid */}
      {open && (
        <div className="space-y-2">
          {/* Search row */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value.slice(0, 30))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleEnter() }
                if (e.key === 'Escape') { setOpen(false); setSearch('') }
              }}
              placeholder="Search or type a new topic…"
              className="glass-input flex-1 rounded-[var(--r-full)] px-3.5 py-2 text-sm min-w-0"
            />
            <button
              type="button"
              onClick={() => { setOpen(false); setSearch('') }}
              className="glass px-3 py-2 rounded-[var(--r-full)] text-text-muted text-sm active:opacity-60 transition-opacity shrink-0"
              aria-label="Close board picker"
            >
              ✕
            </button>
          </div>

          {/* Board chips grid - scrollable */}
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto no-scrollbar pb-1">
            {displayBoards.map((board) => (
              <button
                type="button"
                key={board.id}
                onClick={() => select(board.id)}
                className={cn(
                  'px-3 py-1.5 rounded-[var(--r-full)] text-xs font-medium transition-all active:scale-95 shrink-0',
                  selected === board.id
                    ? 'bg-accent text-background shadow-sm shadow-accent/30'
                    : 'glass text-text-secondary'
                )}
              >
                #{board.label}
              </button>
            ))}

            {/* Create new board chip */}
            {showCreate && (
              <button
                type="button"
                onClick={() => select(normalizeBoard(search))}
                className="px-3 py-1.5 rounded-[var(--r-full)] text-xs font-medium glass text-accent border border-accent/30 transition-all active:scale-95 shrink-0 flex items-center gap-1"
              >
                <span className="opacity-70">+</span>
                #{normalizeBoard(search)}
              </button>
            )}

            {/* Nothing matched at all */}
            {displayBoards.length === 0 && !showCreate && searchTerm && (
              <p className="text-text-muted text-xs py-1">No boards match. Press Enter to create.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
