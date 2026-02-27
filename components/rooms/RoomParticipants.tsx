'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { RoomParticipant } from '@/lib/types'

interface RoomParticipantsProps {
  open: boolean
  onClose: () => void
  participants: RoomParticipant[]
  hostHash: string
  callerHash: string | null
  roomId: string
  onMute: (targetHash: string) => void
  onKick: (targetHash: string) => void
}

export function RoomParticipants({
  open, onClose, participants, hostHash, callerHash, roomId, onMute, onKick
}: RoomParticipantsProps) {
  const isHost = callerHash === hostHash

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 inset-x-0 z-50 glass-sidebar rounded-t-[var(--r-2xl)] pb-[max(env(safe-area-inset-bottom),24px)] max-h-[70vh] flex flex-col"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="w-9 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-4 shrink-0" />
            <div className="px-5 mb-3 shrink-0">
              <h2 className="text-text font-bold">
                Participants <span className="text-text-muted font-normal text-sm">({participants.length})</span>
              </h2>
            </div>

            <div className="overflow-y-auto px-5 space-y-2">
              {participants.map((p) => (
                <div
                  key={p.nullifierHash}
                  className="flex items-center gap-3 py-2.5"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    p.nullifierHash === hostHash
                      ? 'bg-accent/20 text-accent'
                      : 'bg-white/10 text-text-secondary'
                  }`}>
                    {p.displayHandle.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-text text-sm font-medium truncate">{p.displayHandle}</p>
                    <p className="text-text-muted text-[10px]">
                      {p.nullifierHash === hostHash ? 'Host' : p.identityMode}
                      {p.isMuted && ' · Muted'}
                    </p>
                  </div>

                  {/* Host controls — only visible to host, not for themselves */}
                  {isHost && p.nullifierHash !== callerHash && (
                    <div className="flex gap-2 shrink-0">
                      {!p.isMuted && (
                        <button
                          onClick={() => onMute(p.nullifierHash)}
                          className="text-[11px] text-text-muted glass px-2.5 py-1.5 rounded-[var(--r-md)] active:opacity-70 transition-opacity"
                        >
                          Mute
                        </button>
                      )}
                      <button
                        onClick={() => onKick(p.nullifierHash)}
                        className="text-[11px] text-text-muted glass px-2.5 py-1.5 rounded-[var(--r-md)] active:opacity-70 transition-opacity"
                      >
                        Kick
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
