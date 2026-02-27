'use client'

import { BOARDS } from '@/lib/types'
import { BoardTag } from '@/components/ui/BoardTag'
import { useArkoraStore } from '@/store/useArkoraStore'
import { useRouter } from 'next/navigation'

export default function BoardsPage() {
  const { setActiveBoard } = useArkoraStore()
  const router = useRouter()

  function handleSelect(boardId: (typeof BOARDS)[number]['id']) {
    setActiveBoard(boardId)
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <h1 className="text-2xl font-bold text-text mb-1">Boards</h1>
      <p className="text-text-secondary text-sm mb-6">
        Every post from a verified human.
      </p>

      <div className="space-y-3">
        {BOARDS.map((board) => (
          <button
            key={board.id}
            onClick={() => handleSelect(board.id)}
            className="w-full flex items-center gap-3 glass rounded-[var(--r-xl)] p-4 text-left active:scale-95 transition-transform"
          >
            <div>
              <div className="text-text font-semibold">#{board.label}</div>
              <div className="text-text-muted text-xs mt-0.5">
                {board.id === 'confessions'
                  ? 'Anonymous + verified human - completely unlinkable'
                  : 'Tap to browse'}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
