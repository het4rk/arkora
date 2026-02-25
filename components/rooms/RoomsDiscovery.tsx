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
  const [selectedBoard, setSelectedBoard] = useState<BoardId | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [joiningRoom, setJoiningRoom] = useState<Room | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const url = selectedBoard
        ? `/api/rooms?boardId=${selectedBoard}`
        : '/api/rooms'
      const res = await fetch(url)
      const json = (await res.json()) as { success: boolean; data?: Room[] }
      if (json.success && json.data) setRooms(json.data)
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
            className="bg-accent text-white font-semibold text-sm px-4 py-2 rounded-[var(--r-full)] active:scale-95 transition-all"
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
            <span>{b.emoji}</span>
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

        {!isLoading && rooms.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-20 gap-4">
            <p className="text-4xl">🎙️</p>
            <p className="text-text font-semibold">No live rooms</p>
            <p className="text-text-muted text-sm">
              {isVerified ? 'Start the first one.' : 'Verify with World ID to start a room.'}
            </p>
            {isVerified && (
              <button
                onClick={() => setShowCreate(true)}
                className="bg-accent text-white font-semibold px-6 py-3 rounded-[var(--r-lg)] text-sm active:scale-95 transition-all"
              >
                Start a Room
              </button>
            )}
          </div>
        )}

        {!isLoading && rooms.map((room) => (
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
