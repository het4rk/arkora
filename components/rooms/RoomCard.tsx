'use client'

import { BoardTag } from '@/components/ui/BoardTag'
import type { Room } from '@/lib/types'

interface RoomCardProps {
  room: Room
  onJoin: (room: Room) => void
}

export function RoomCard({ room, onJoin }: RoomCardProps) {
  const minutesLeft = Math.max(0, Math.floor((new Date(room.endsAt).getTime() - Date.now()) / 60_000))
  const timeLabel = minutesLeft >= 60
    ? `${Math.floor(minutesLeft / 60)}h left`
    : `${minutesLeft}m left`

  return (
    <div className="glass rounded-[var(--r-xl)] p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-text font-semibold text-sm leading-snug line-clamp-2">{room.title}</p>
          <p className="text-text-muted text-[11px] mt-1">
            Started by <span className="text-text-secondary">{room.hostHandle}</span>
          </p>
        </div>
        <BoardTag boardId={room.boardId} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] text-text-muted">
          <span className="flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {room.participantCount ?? 0}/{room.maxParticipants}
          </span>
          <span className="flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {timeLabel}
          </span>
          {room.messageCount > 0 && (
            <span>{room.messageCount} msg{room.messageCount !== 1 ? 's' : ''}</span>
          )}
        </div>

        <button
          onClick={() => onJoin(room)}
          className="bg-accent text-background text-xs font-semibold px-4 py-2 rounded-[var(--r-full)] active:scale-95 transition-all"
        >
          Join
        </button>
      </div>
    </div>
  )
}
