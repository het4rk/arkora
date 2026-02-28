'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Pusher from 'pusher-js'
import { useArkoraStore } from '@/store/useArkoraStore'
import { RoomMessageRow } from '@/components/rooms/RoomMessage'
import { RoomComposer } from '@/components/rooms/RoomComposer'
import { RoomParticipants } from '@/components/rooms/RoomParticipants'
import { BoardTag } from '@/components/ui/BoardTag'
import { cn, shareUrl } from '@/lib/utils'
import { useVoiceRoom } from '@/components/rooms/useVoiceRoom'
import type { Room, RoomParticipant, RoomMessage } from '@/lib/types'

const LIVEKIT_ENABLED = !!process.env.NEXT_PUBLIC_LIVEKIT_URL

// Equalizer bars - pulses faster when speaking
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

function getInitials(handle: string): string {
  return handle
    .split(/[\s.#_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

// Participant bubble in the voice-room grid
function ParticipantBubble({
  participant,
  isSpeaking,
  isHost,
  isSelf,
  selfMuted,
}: {
  participant: RoomParticipant
  isSpeaking: boolean
  isHost: boolean
  isSelf: boolean
  selfMuted: boolean
}) {
  const muted = participant.isMuted || (isSelf && selfMuted)
  return (
    <div className="flex flex-col items-center gap-2 py-2 px-2 min-w-[72px]">
      <div className="relative">
        {/* Avatar */}
        <div
          className={cn(
            'w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold select-none transition-all duration-300',
            isSpeaking
              ? 'bg-accent text-background shadow-lg shadow-accent/40 scale-105'
              : 'glass text-text-secondary'
          )}
        >
          {getInitials(participant.displayHandle)}
        </div>

        {/* Sound waves below avatar when speaking */}
        {isSpeaking && !muted && (
          <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2">
            <SoundWaveBars active className="text-accent" />
          </div>
        )}

        {/* Host crown */}
        {isHost && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-accent rounded-full flex items-center justify-center shadow-sm">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" className="text-background">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
        )}

        {/* Muted indicator */}
        {muted && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-surface-up border border-border rounded-full flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
        )}
      </div>

      {/* Handle */}
      <p className="text-[10px] font-medium text-text-secondary text-center leading-tight max-w-[72px] truncate mt-0.5">
        {isSelf ? 'You' : participant.displayHandle.split('#')[0]}
      </p>
    </div>
  )
}

interface RoomViewProps {
  roomId: string
}

export function RoomView({ roomId }: RoomViewProps) {
  const router = useRouter()
  const { nullifierHash, setActiveRoomId, setActiveRoomTitle } = useArkoraStore()

  const [room, setRoom] = useState<Room | null>(null)
  const [participants, setParticipants] = useState<RoomParticipant[]>([])
  const [messages, setMessages] = useState<RoomMessage[]>([])
  const [myParticipant, setMyParticipant] = useState<RoomParticipant | null>(null)
  const [showParticipants, setShowParticipants] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasEnded, setHasEnded] = useState(false)
  const [connectionLost, setConnectionLost] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [showChat, setShowChat] = useState(false)

  // Voice (LiveKit)
  const { voiceState, isMicMuted, speakingSet: voiceSpeakingSet, voiceError, joinVoice, leaveVoice, toggleMic, forceMuteMic } =
    useVoiceRoom(roomId, nullifierHash)

  // Fallback speaking state (4s timer) used when voice is not active
  const [fallbackSpeakingSet, setFallbackSpeakingSet] = useState<Set<string>>(new Set())
  const speakingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Use real voice speaking data when connected, fallback to message-based timer otherwise
  const speakingSet = voiceState === 'connected' ? voiceSpeakingSet : fallbackSpeakingSet

  // Self-mute state: when voice is active, isMicMuted from the hook is authoritative
  const selfMuted = voiceState === 'connected' ? isMicMuted : false

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pusherRef = useRef<InstanceType<typeof Pusher> | null>(null)
  const skipLeaveOnUnmountRef = useRef(false)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Mark a participant as speaking for 4 seconds (text-only fallback)
  const markSpeaking = useCallback((hash: string) => {
    setFallbackSpeakingSet((prev) => {
      const next = new Set(prev)
      next.add(hash)
      return next
    })
    const existing = speakingTimersRef.current.get(hash)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      setFallbackSpeakingSet((prev) => {
        const next = new Set(prev)
        next.delete(hash)
        return next
      })
      speakingTimersRef.current.delete(hash)
    }, 4000)
    speakingTimersRef.current.set(hash, timer)
  }, [])

  async function handleShare() {
    if (!room) return
    const result = await shareUrl(`/rooms/${roomId}`, room.title, `Join the live room: ${room.title}`)
    if (result === 'copied') {
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    }
  }

  // Load room details
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

  // Cleanup speaking timers on unmount
  useEffect(() => {
    const timers = speakingTimersRef.current
    return () => {
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
    }
  }, [])

  // Fire leave API when user navigates away without pressing Leave
  useEffect(() => {
    return () => {
      if (!skipLeaveOnUnmountRef.current && nullifierHash) {
        void fetch(`/api/rooms/${roomId}/leave`, { method: 'POST' })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  // Subscribe to Pusher presence channel
  useEffect(() => {
    if (!nullifierHash || !room) return

    const key = process.env.NEXT_PUBLIC_PUSHER_KEY
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER
    if (!key || !cluster) return

    let pusher: InstanceType<typeof Pusher> | null = null

    function initPusher() {
      if (pusher) {
        pusher.unsubscribe(`presence-room-${roomId}`)
        pusher.disconnect()
      }

      try {
        pusher = new Pusher(key!, {
          cluster: cluster!,
          channelAuthorization: {
            endpoint: '/api/pusher/auth',
            transport: 'ajax',
          },
        })
        pusherRef.current = pusher

        const channel = pusher.subscribe(`presence-room-${roomId}`)

        channel.bind('pusher:subscription_succeeded', () => {
          setConnectionLost(false)
        })

        channel.bind('pusher:subscription_error', (err: unknown) => {
          console.warn('[RoomView] Pusher subscription error', err)
          setConnectionLost(true)
        })

        channel.bind('new-message', (msg: RoomMessage) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          markSpeaking(msg.senderHash)
          setTimeout(scrollToBottom, 50)
        })

        channel.bind('participant-muted', (data: { targetHash: string }) => {
          setParticipants((prev) =>
            prev.map((p) => p.nullifierHash === data.targetHash ? { ...p, isMuted: true } : p)
          )
          if (data.targetHash === nullifierHash) {
            setMyParticipant((prev) => prev ? { ...prev, isMuted: true } : prev)
            // Silence the LiveKit mic track immediately - host-muted users must not transmit
            forceMuteMic()
          }
        })

        channel.bind('participant-kicked', (data: { targetHash: string }) => {
          setParticipants((prev) => prev.filter((p) => p.nullifierHash !== data.targetHash))
          if (data.targetHash === nullifierHash) {
            router.push('/rooms')
          }
        })

        channel.bind('room-ended', () => {
          leaveVoice()
          setHasEnded(true)
        })

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

        channel.bind('pusher:member_removed', (member: { id: string }) => {
          setParticipants((prev) => prev.filter((p) => p.nullifierHash !== member.id))
        })

        // Reconnect Pusher when the tab becomes visible again (mobile backgrounding fix)
        function handleVisibilityChange() {
          if (document.visibilityState === 'visible' && pusher) {
            // If connection is not in connected state, force reconnect
            const state = pusher.connection.state
            if (state === 'disconnected' || state === 'failed' || state === 'unavailable') {
              pusher.connect()
            }
          }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)

        // Store cleanup ref so we can remove it
        ;(pusher as unknown as { _visibilityCleanup?: () => void })._visibilityCleanup =
          () => document.removeEventListener('visibilitychange', handleVisibilityChange)
      } catch (err) {
        console.error('[RoomView] Pusher setup error', err)
      }
    }

    initPusher()

    return () => {
      if (pusher) {
        ;(pusher as unknown as { _visibilityCleanup?: () => void })._visibilityCleanup?.()
        pusher.unsubscribe(`presence-room-${roomId}`)
        pusher.disconnect()
        pusherRef.current = null
      }
    }
  }, [nullifierHash, room, roomId, router, scrollToBottom, markSpeaking])

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
    leaveVoice()
    skipLeaveOnUnmountRef.current = true
    setActiveRoomId(null)
    setActiveRoomTitle(null)
    await fetch(`/api/rooms/${roomId}`, { method: 'DELETE' })
    router.push('/rooms')
  }

  async function handleLeave() {
    leaveVoice()
    skipLeaveOnUnmountRef.current = true
    setActiveRoomId(null)
    setActiveRoomTitle(null)
    await fetch(`/api/rooms/${roomId}/leave`, { method: 'POST' })
    router.push('/rooms')
  }

  function handleMinimize() {
    if (!room) return
    skipLeaveOnUnmountRef.current = true
    setActiveRoomId(roomId)
    setActiveRoomTitle(room.title)
    router.back()
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
          type="button"
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
  const effectivelyMuted = myParticipant.isMuted || selfMuted
  const voiceAvailable = LIVEKIT_ENABLED

  return (
    <div className="flex flex-col h-dvh">
      {/* Header */}
      <div className="px-4 pt-[max(env(safe-area-inset-top),16px)] pb-3 border-b border-border/25 flex items-center gap-3">
        <button
          type="button"
          onClick={handleMinimize}
          className="text-text-muted active:opacity-70 transition-opacity shrink-0"
          aria-label="Minimize room"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-text font-semibold text-sm truncate">{room.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <BoardTag boardId={room.boardId} />
          </div>
        </div>
        <button
          type="button"
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
        <button
          type="button"
          onClick={() => void handleShare()}
          aria-label="Share room"
          className={cn(
            'text-xs glass px-3 py-1.5 rounded-[var(--r-full)] shrink-0 active:opacity-70 transition-all',
            shareCopied ? 'text-accent' : 'text-text-muted'
          )}
        >
          {shareCopied ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          )}
        </button>
        {isHost && (
          <button
            type="button"
            onClick={() => void handleEndRoom()}
            className="text-text-muted text-xs glass px-3 py-1.5 rounded-[var(--r-full)] shrink-0 active:opacity-70 transition-opacity"
          >
            End
          </button>
        )}
      </div>

      {/* Connection lost banner with reconnect */}
      {connectionLost && (
        <div className="px-4 py-2 bg-surface-up border-b border-border flex items-center justify-between gap-3">
          <p className="text-text-secondary text-xs">Connection lost - messages may not arrive.</p>
          <button
            type="button"
            onClick={() => {
              if (pusherRef.current) {
                pusherRef.current.connect()
                setConnectionLost(false)
              }
            }}
            className="text-accent text-xs font-semibold shrink-0 active:opacity-70"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* Participant grid */}
      <div className="px-4 pt-4 pb-3 border-b border-border/25">
        <div className="flex flex-wrap gap-1 justify-start">
          {participants.map((p) => (
            <ParticipantBubble
              key={p.nullifierHash}
              participant={p}
              isSpeaking={speakingSet.has(p.nullifierHash)}
              isHost={p.nullifierHash === room.hostHash}
              isSelf={p.nullifierHash === nullifierHash}
              selfMuted={selfMuted}
            />
          ))}
        </div>
      </div>

      {/* Voice error */}
      {voiceError && (
        <div className="px-4 py-2 border-b border-border/25">
          <p className="text-text-muted text-xs text-center">{voiceError}</p>
        </div>
      )}

      {/* Messages (chat backup) - collapsible */}
      {showChat && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-10">
              <p className="text-text-muted text-sm">No messages yet</p>
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
      )}

      {/* When chat is hidden, fill remaining space */}
      {!showChat && <div className="flex-1" />}

      {/* Bottom controls */}
      <div className="border-t border-border/25 pb-[max(env(safe-area-inset-bottom),8px)]">
        {/* Primary voice controls row */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-3">
          {/* Mic / voice join button */}
          {voiceAvailable && (
            voiceState === 'idle' || voiceState === 'error' ? (
              <button
                type="button"
                onClick={() => void joinVoice()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--r-full)] bg-accent/10 border border-accent/30 text-accent text-sm font-semibold active:scale-95 transition-all shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
                Join Voice
              </button>
            ) : voiceState === 'connecting' ? (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--r-full)] glass text-text-muted text-sm shrink-0">
                <div className="w-3.5 h-3.5 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
                Connecting…
              </div>
            ) : (
              // Connected - show mic toggle + leave voice
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={myParticipant.isMuted}
                  className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-all disabled:opacity-40 shrink-0',
                    effectivelyMuted
                      ? 'glass text-text-muted'
                      : 'bg-accent text-background shadow-lg shadow-accent/30'
                  )}
                  aria-label={effectivelyMuted ? 'Unmute mic' : 'Mute mic'}
                >
                  {effectivelyMuted ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  )}
                </button>
                {!effectivelyMuted && speakingSet.has(nullifierHash ?? '') && (
                  <SoundWaveBars active className="text-accent" />
                )}
                <button
                  type="button"
                  onClick={leaveVoice}
                  className="text-text-muted text-xs glass px-3 py-2 rounded-[var(--r-full)] shrink-0 active:opacity-70 transition-opacity ml-1"
                >
                  Leave voice
                </button>
              </div>
            )
          )}

          {/* When voice not available, show legacy self-mute */}
          {!voiceAvailable && (
            <button
              type="button"
              onClick={() => {/* no-op without LiveKit */ }}
              disabled={myParticipant.isMuted}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--r-full)] text-xs font-semibold transition-all active:scale-95 disabled:opacity-40',
                effectivelyMuted
                  ? 'glass text-text-muted'
                  : 'bg-accent/10 text-accent border border-accent/20'
              )}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              {myParticipant.isMuted ? 'Muted by host' : 'Mute'}
            </button>
          )}

          <div className="flex-1" />

          {/* Chat toggle */}
          <button
            type="button"
            onClick={() => setShowChat((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-2 rounded-[var(--r-full)] glass transition-all active:opacity-70 shrink-0',
              showChat ? 'text-accent' : 'text-text-muted',
              messages.length > 0 && !showChat && 'border border-accent/30'
            )}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {messages.length > 0 ? `Chat (${messages.length})` : 'Chat'}
          </button>

          {/* Leave / End room */}
          <button
            type="button"
            onClick={() => void handleLeave()}
            className="text-text-muted text-xs glass px-3 py-2 rounded-[var(--r-full)] shrink-0 active:opacity-70 transition-opacity"
          >
            Leave
          </button>
        </div>

        {/* Chat composer (secondary) - only shown when chat is open */}
        {showChat && (
          <RoomComposer
            roomId={roomId}
            isMuted={effectivelyMuted}
            onSent={scrollToBottom}
          />
        )}
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
