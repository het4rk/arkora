'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Room } from '@/lib/types'

interface LiveRoomsStripProps {
  boardId?: string
}

export function LiveRoomsStrip({ boardId }: LiveRoomsStripProps) {
  const router = useRouter()
  const [rooms, setRooms] = useState<Room[]>([])

  const fetchRooms = useCallback(() => {
    const url = boardId
      ? `/api/rooms?boardId=${encodeURIComponent(boardId)}`
      : '/api/rooms'
    void fetch(url, { signal: AbortSignal.timeout(8000) })
      .then((r) => r.json())
      .then((j: { success: boolean; data?: Room[] }) => {
        if (j.success && j.data) setRooms(j.data)
        else if (j.success) setRooms([])
      })
      .catch(() => null)
  }, [boardId])

  useEffect(() => {
    fetchRooms()
    const timer = setInterval(fetchRooms, 30_000)
    return () => clearInterval(timer)
  }, [fetchRooms])

  if (rooms.length === 0) return null

  return (
    <div className="px-4 pt-3 pb-2">
      <div className="flex items-center gap-1.5 mb-2">
        <div className="flex items-end gap-[2px] text-accent sound-wave-active">
          <span className="sound-bar sound-bar-2" />
          <span className="sound-bar sound-bar-4" />
          <span className="sound-bar sound-bar-3" />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">Live Rooms</p>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
        {rooms.map((room) => (
          <button
            key={room.id}
            type="button"
            onClick={() => router.push(`/rooms/${room.id}`)}
            className="glass rounded-[var(--r-xl)] px-3.5 py-3 shrink-0 text-left active:scale-[0.97] transition-all w-[200px]"
          >
            <p className="text-text font-semibold text-xs leading-snug line-clamp-2 mb-2">{room.title}</p>
            <div className="flex items-center gap-2 text-[10px] text-text-muted">
              <span className="flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {room.participantCount ?? 0}
              </span>
              <span className="text-accent font-medium">● Live</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
