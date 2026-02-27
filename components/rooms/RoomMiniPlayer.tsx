'use client'

import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useArkoraStore } from '@/store/useArkoraStore'

/**
 * Floating mini-player bar shown when user minimizes a live room.
 * Appears above BottomNav. Tap to return to the room. X to leave.
 */
export function RoomMiniPlayer() {
  const router = useRouter()
  const { activeRoomId, activeRoomTitle, setActiveRoomId, setActiveRoomTitle } = useArkoraStore()

  async function handleLeave(e: React.MouseEvent) {
    e.stopPropagation()
    if (!activeRoomId) return
    setActiveRoomId(null)
    setActiveRoomTitle(null)
    void fetch(`/api/rooms/${activeRoomId}/leave`, { method: 'POST' })
  }

  function handleExpand() {
    if (!activeRoomId) return
    router.push(`/rooms/${activeRoomId}`)
  }

  return (
    <AnimatePresence>
      {activeRoomId && (
        <motion.div
          className="fixed bottom-[calc(64px+env(safe-area-inset-bottom,0px))] inset-x-0 z-30 px-3"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        >
          <button
            type="button"
            onClick={handleExpand}
            className="w-full flex items-center gap-3 px-4 py-3 glass-sidebar rounded-[var(--r-xl)] shadow-lg active:scale-[0.98] transition-all"
          >
            {/* Pulsing live dot */}
            <span className="relative shrink-0 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>

            {/* Title */}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-text text-xs font-semibold truncate">
                {activeRoomTitle ?? 'Live Room'}
              </p>
              <p className="text-text-muted text-[10px]">Tap to return</p>
            </div>

            {/* Expand icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>

            {/* Leave button */}
            <button
              type="button"
              onClick={(e) => void handleLeave(e)}
              aria-label="Leave room"
              className="shrink-0 w-7 h-7 rounded-full glass flex items-center justify-center text-text-muted active:scale-90 transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
