'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useArkoraStore } from '@/store/useArkoraStore'
import { BOARDS } from '@/lib/types'
import type { BoardId } from '@/lib/types'

interface CreateRoomSheetProps {
  open: boolean
  onClose: () => void
  onCreated: (roomId: string) => void
}

export function CreateRoomSheet({ open, onClose, onCreated }: CreateRoomSheetProps) {
  const { nullifierHash, identityMode, persistentAlias, user } = useArkoraStore()
  const [title, setTitle] = useState('')
  const [boardId, setBoardId] = useState<BoardId>('arkora')
  const [maxParticipants, setMaxParticipants] = useState(50)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function resolveHostHandle(): string {
    if (!nullifierHash) return 'Human'
    if (identityMode === 'alias' && persistentAlias) return persistentAlias
    if (identityMode === 'named' && user?.pseudoHandle) return user.pseudoHandle
    return `Human #${nullifierHash.slice(-4)}`
  }

  async function handleCreate() {
    if (!title.trim() || isCreating) return
    setIsCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          boardId,
          maxParticipants,
          hostHandle: resolveHostHandle(),
        }),
      })
      const json = (await res.json()) as { success: boolean; data?: { id: string }; error?: string }
      if (!json.success || !json.data) {
        setError(json.error ?? 'Failed to create room')
        return
      }
      setTitle('')
      onCreated(json.data.id)
    } catch {
      setError('Network error')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 inset-x-0 z-50 glass-sidebar rounded-t-[var(--r-2xl)] pb-[max(env(safe-area-inset-bottom),24px)]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="w-9 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-5" />

            <div className="px-5">
              <h2 className="text-text font-bold text-lg mb-5">Start a Room</h2>

              {/* Title */}
              <div className="mb-4">
                <label className="text-text-muted text-[10px] font-semibold uppercase tracking-[0.12em] block mb-2">
                  Topic
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                  placeholder="What are you talking about?"
                  className="glass-input w-full rounded-[var(--r-md)] px-4 py-3 text-sm"
                  autoFocus
                />
                <p className="text-text-muted text-[10px] text-right mt-1">{title.length}/100</p>
              </div>

              {/* Board */}
              <div className="mb-4">
                <label className="text-text-muted text-[10px] font-semibold uppercase tracking-[0.12em] block mb-2">
                  Board
                </label>
                <div className="flex flex-wrap gap-2">
                  {BOARDS.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setBoardId(b.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-[var(--r-full)] text-xs font-medium border transition-all active:scale-95 ${
                        boardId === b.id
                          ? 'bg-accent/15 border-accent/40 text-accent'
                          : 'glass text-text-secondary'
                      }`}
                    >
                      <span>{b.emoji}</span>
                      <span>#{b.id}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Max participants */}
              <div className="mb-5">
                <label className="text-text-muted text-[10px] font-semibold uppercase tracking-[0.12em] block mb-2">
                  Max participants: {maxParticipants}
                </label>
                <input
                  type="range"
                  min={2}
                  max={200}
                  step={10}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(Number(e.target.value))}
                  className="w-full accent-accent"
                />
                <div className="flex justify-between text-[10px] text-text-muted mt-0.5">
                  <span>2</span><span>200</span>
                </div>
              </div>

              {error && (
                <p className="text-downvote text-xs mb-3">{error}</p>
              )}

              <button
                onClick={() => void handleCreate()}
                disabled={!title.trim() || isCreating}
                className="w-full bg-accent text-white font-semibold py-3.5 rounded-[var(--r-lg)] text-sm active:scale-[0.98] disabled:opacity-50 transition-all"
              >
                {isCreating ? 'Starting…' : 'Start Room'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
