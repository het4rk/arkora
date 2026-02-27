'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Pusher from 'pusher-js'
import { useArkoraStore } from '@/store/useArkoraStore'
import { RoomMessageRow } from '@/components/rooms/RoomMessage'
import { RoomComposer } from '@/components/rooms/RoomComposer'
import { RoomParticipants } from '@/components/rooms/RoomParticipants'
import { BoardTag } from '@/components/ui/BoardTag'
import type { Room, RoomParticipant, RoomMessage } from '@/lib/types'

// Animated equalizer bars — pulses faster when recently active
function SoundWaveBars({ active, className = '' }: { active?: boolean; className?: string }) {
  return (
    <div className={`flex items-end gap-[2.5px] ${active ? 'sound-wave-active' : ''} ${className}`}>
      <span className="sound-bar sound-bar-1" />
      <span className="sound-bar sound-bar-2" />
      <span className="sound-bar sound-bar-3" />
      <span className="sound-bar sound-bar-4" />
      <span className="sound-bar sound-bar-5" />
    </div>
  )
}

interface RoomViewProps {
  roomId: string
}

export function RoomView({ roomId }: RoomViewProps) {
  const router = useRouter()
  const { nullifierHash } = useArkoraStore()

  const [room, setRoom] = useState<Room | null>(null)
  const [participants, setParticipants] = useState<RoomParticipant[]>([])
  const [messages, setMessages] = useState<RoomMessage[]>([])
  const [myParticipant, setMyParticipant] = useState<RoomParticipant | null>(null)
  const [showParticipants, setShowParticipants] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasEnded, setHasEnded] = useState(false)
  const [connectionLost, setConnectionLost] = useState(false)
  const [recentActivity, setRecentActivity] = useState(false)
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pusherRef = useRef<InstanceType<typeof Pusher> | null>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const flashActivity = useCallback(() => {
    setRecentActivity(true)
    if (activityTimerRef.current) clearTimeout(activityTimerRef.current)
    activityTimerRef.current = setTimeout(() => setRecentActivity(false), 3000)
  }, [])

  // Load room details + check if we're already a participant
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}`)
        const json = (await res.json()) as {
          success: boolean
          data?: { room: Room; participants: RoomParticipant[] }
        }
        if (!json.success || !json.data) { router.push('/rooms'); return }
        if (!json.data.room.isLive) { setHasEnded(true); setIsLoading(false); return }

        setRoom(json.data.room)
        setParticipants(json.data.participants)
        const me = json.data.participants.find((p) => p.nullifierHash === nullifierHash)
        setMyParticipant(me ?? null)
      } finally {
        setIsLoading(false)
      }
    })()
  }, [roomId, nullifierHash, router])

  // Subscribe to Pusher presence channel
  useEffect(() => {
    if (!nullifierHash || !room) return

    const key = process.env.NEXT_PUBLIC_PUSHER_KEY
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER
    if (!key || !cluster) return

    let pusher: InstanceType<typeof Pusher> | null = null
    try {
      pusher = new Pusher(key, {
        cluster,
        channelAuthorization: {
          endpoint: '/api/pusher/auth',
          transport: 'ajax',
        },
      })
      pusherRef.current = pusher

      const channel = pusher.subscribe(`presence-room-${roomId}`)

      channel.bind('new-message', (msg: RoomMessage) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev
          return [...prev, msg]
        })
        flashActivity()
        setTimeout(scrollToBottom, 50)
      })

      channel.bind('pusher:subscription_error', () => {
        setConnectionLost(true)
      })

      channel.bind('participant-muted', (data: { targetHash: string }) => {
        setParticipants((prev) =>
          prev.map((p) => p.nullifierHash === data.targetHash ? { ...p, isMuted: true } : p)
        )
        if (data.targetHash === nullifierHash) {
          setMyParticipant((prev) => prev ? { ...prev, isMuted: true } : prev)
        }
      })

      channel.bind('participant-kicked', (data: { targetHash: string }) => {
        setParticipants((prev) => prev.filter((p) => p.nullifierHash !== data.targetHash))
        if (data.targetHash === nullifierHash) {
          router.push('/rooms')
        }
      })

      channel.bind('room-ended', () => {
        setHasEnded(true)
      })

      // Presence: member joined
      channel.bind('pusher:member_added', (member: { id: string; info: { displayHandle: string; identityMode: string; isMuted: boolean; isCoHost: boolean } }) => {
        setParticipants((prev) => {
          if (prev.some((p) => p.nullifierHash === member.id)) return prev
          return [...prev, {
            id: member.id,
            roomId,
            nullifierHash: member.id,
            displayHandle: member.info.displayHandle,
            identityMode: member.info.identityMode as RoomParticipant['identityMode'],
            joinedAt: new Date(),
            leftAt: null,
            isMuted: member.info.isMuted,
            isCoHost: member.info.isCoHost,
          }]
        })
      })

      // Presence: member left
      channel.bind('pusher:member_removed', (member: { id: string }) => {
        setParticipants((prev) => prev.filter((p) => p.nullifierHash !== member.id))
      })
    } catch (err) {
      console.error('[RoomView] Pusher error', err)
    }

    return () => {
      if (pusher) {
        pusher.unsubscribe(`presence-room-${roomId}`)
        pusher.disconnect()
        pusherRef.current = null
      }
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current)
    }
  }, [nullifierHash, room, roomId, router, scrollToBottom, flashActivity])

  async function handleMute(targetHash: string) {
    await fetch(`/api/rooms/${roomId}/mute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetHash }),
    })
  }

  async function handleKick(targetHash: string) {
    await fetch(`/api/rooms/${roomId}/kick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetHash }),
    })
  }

  async function handleEndRoom() {
    await fetch(`/api/rooms/${roomId}`, { method: 'DELETE' })
    router.push('/rooms')
  }

  async function handleLeave() {
    await fetch(`/api/rooms/${roomId}/leave`, { method: 'POST' })
    router.push('/rooms')
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  if (hasEnded) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-4">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
        <p className="text-text font-bold text-lg">Room Ended</p>
        <p className="text-text-muted text-sm">This room is no longer live.</p>
        <button
          onClick={() => router.push('/rooms')}
          className="bg-accent text-background font-semibold px-6 py-3 rounded-[var(--r-lg)] text-sm active:scale-95 transition-all"
        >
          Back to Rooms
        </button>
      </div>
    )
  }

  if (!room || !myParticipant) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
        Room not found.
      </div>
    )
  }

  const isHost = nullifierHash === room.hostHash

  return (
    <div className="flex flex-col h-dvh">
      {/* Header */}
      <div className="px-4 pt-[max(env(safe-area-inset-top),16px)] pb-3 border-b border-border/25 flex items-center gap-3">
        <button
          onClick={() => void handleLeave()}
          className="text-text-muted active:opacity-70 transition-opacity shrink-0"
          aria-label="Leave room"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-text font-semibold text-sm truncate">{room.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <SoundWaveBars active={recentActivity} className="text-accent shrink-0" />
            <BoardTag boardId={room.boardId} />
            <span className="text-text-muted text-[10px] truncate">
              {myParticipant.displayHandle}
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowParticipants(true)}
          className="flex items-center gap-1.5 text-text-secondary text-xs glass px-3 py-1.5 rounded-[var(--r-full)] shrink-0 active:opacity-70 transition-opacity"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {participants.length}
        </button>
        {isHost && (
          <button
            onClick={() => void handleEndRoom()}
            className="text-text-muted text-xs glass px-3 py-1.5 rounded-[var(--r-full)] shrink-0 active:opacity-70 transition-opacity"
          >
            End
          </button>
        )}
      </div>

      {/* Pusher connection lost banner */}
      {connectionLost && (
        <div className="px-4 py-2 bg-surface-up border-b border-border text-center">
          <p className="text-text-secondary text-xs">Connection lost — new messages may not arrive. Refresh to reconnect.</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-16">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
            <p className="text-text font-semibold">Room is live</p>
            <p className="text-text-muted text-sm">Start the conversation</p>
          </div>
        )}
        {messages.map((msg) => (
          <RoomMessageRow
            key={msg.id}
            message={msg}
            isOwn={msg.senderHash === nullifierHash}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-border/25 pb-[max(env(safe-area-inset-bottom),8px)]">
        <RoomComposer
          roomId={roomId}
          isMuted={myParticipant.isMuted}
          onSent={scrollToBottom}
        />
      </div>

      {/* Participants sheet */}
      <RoomParticipants
        open={showParticipants}
        onClose={() => setShowParticipants(false)}
        participants={participants}
        hostHash={room.hostHash}
        callerHash={nullifierHash}
        roomId={roomId}
        onMute={(hash) => void handleMute(hash)}
        onKick={(hash) => void handleKick(hash)}
      />
    </div>
  )
}
