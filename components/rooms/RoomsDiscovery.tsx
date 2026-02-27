'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useArkoraStore } from '@/store/useArkoraStore'
import { RoomCard } from '@/components/rooms/RoomCard'
import { CreateRoomSheet } from '@/components/rooms/CreateRoomSheet'
import { JoinIdentitySheet } from '@/components/rooms/JoinIdentitySheet'
import { BOARDS } from '@/lib/types'
import type { Room, BoardId } from '@/lib/types'

export function RoomsDiscovery() {
  const router = useRouter()
  const { isVerified, setActiveRoomId } = useArkoraStore()
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedBoard, setSelectedBoard] = useState<BoardId | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [joiningRoom, setJoiningRoom] = useState<Room | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(false)
    try {
      const url = selectedBoard
        ? `/api/rooms?boardId=${selectedBoard}`
        : '/api/rooms'
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      const json = (await res.json()) as { success: boolean; data?: Room[] }
      if (json.success && json.data) setRooms(json.data)
      else if (!json.success) setError(true)
    } catch {
      setError(true)
    } finally {
      setIsLoading(false)
    }
  }, [selectedBoard])

  useEffect(() => { void load() }, [load])

  async function handleJoin(room: Room, displayHandle: string, identityMode: 'anonymous' | 'alias' | 'named') {
    const res = await fetch(`/api/rooms/${room.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayHandle, identityMode }),
    })
    const json = (await res.json()) as { success: boolean; error?: string }
    if (json.success) {
      setActiveRoomId(room.id)
      router.push(`/rooms/${room.id}`)
    }
  }

  function handleRoomCreated(roomId: string) {
    setShowCreate(false)
    setActiveRoomId(roomId)
    router.push(`/rooms/${roomId}`)
  }

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Header */}
      <div className="px-[5vw] pt-[max(env(safe-area-inset-top),20px)] pb-3 border-b border-border/25 flex items-center justify-between">
        <h1 className="text-text font-bold text-xl">Rooms</h1>
        {isVerified && (
          <button
            onClick={() => setShowCreate(true)}
            className="bg-accent text-background font-semibold text-sm px-4 py-2 rounded-[var(--r-full)] active:scale-95 transition-all"
          >
            + Start
          </button>
        )}
      </div>

      {/* Board filter chips */}
      <div className="px-[5vw] py-3 flex gap-2 overflow-x-auto scrollbar-none border-b border-border/25">
        <button
          onClick={() => setSelectedBoard(null)}
          className={`px-3 py-1.5 rounded-[var(--r-full)] text-xs font-medium border shrink-0 transition-all active:scale-95 ${
            !selectedBoard
              ? 'bg-accent/15 border-accent/40 text-accent'
              : 'glass text-text-secondary'
          }`}
        >
          All boards
        </button>
        {BOARDS.map((b) => (
          <button
            key={b.id}
            onClick={() => setSelectedBoard(selectedBoard === b.id ? null : b.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-[var(--r-full)] text-xs font-medium border shrink-0 transition-all active:scale-95 ${
              selectedBoard === b.id
                ? 'bg-accent/15 border-accent/40 text-accent'
                : 'glass text-text-secondary'
            }`}
          >
            <span>#{b.id}</span>
          </button>
        ))}
      </div>

      {/* Rooms list */}
      <div className="flex-1 px-[5vw] py-4 space-y-3 pb-[max(env(safe-area-inset-bottom),80px)]">
        {isLoading && (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass rounded-[var(--r-xl)] h-28" />
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center text-center py-20 gap-4">
            <p className="text-text font-semibold">Could not load rooms</p>
            <p className="text-text-muted text-sm">Check your connection and try again.</p>
            <button
              type="button"
              onClick={() => void load()}
              className="bg-accent text-background font-semibold px-5 py-2.5 rounded-[var(--r-lg)] text-sm active:scale-95 transition-all"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && rooms.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-20 gap-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted mx-auto"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
            <p className="text-text font-semibold">No live rooms</p>
            <p className="text-text-muted text-sm">
              {isVerified ? 'Start the first one.' : 'Verify with World ID to start a room.'}
            </p>
            {isVerified && (
              <button
                onClick={() => setShowCreate(true)}
                className="bg-accent text-background font-semibold px-6 py-3 rounded-[var(--r-lg)] text-sm active:scale-95 transition-all"
              >
                Start a Room
              </button>
            )}
          </div>
        )}

        {!isLoading && !error && rooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            onJoin={(r) => {
              if (!isVerified) {
                useArkoraStore.getState().setVerifySheetOpen(true)
                return
              }
              setJoiningRoom(r)
            }}
          />
        ))}
      </div>

      <CreateRoomSheet
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleRoomCreated}
      />

      <JoinIdentitySheet
        room={joiningRoom}
        onConfirm={(handle, mode) => {
          if (joiningRoom) void handleJoin(joiningRoom, handle, mode)
          setJoiningRoom(null)
        }}
        onClose={() => setJoiningRoom(null)}
      />
    </div>
  )
}
