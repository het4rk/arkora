'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Room as LiveKitRoom,
  RoomEvent,
  ConnectionState,
} from 'livekit-client'

export type VoiceState = 'idle' | 'connecting' | 'connected' | 'error'

export interface UseVoiceRoomReturn {
  voiceState: VoiceState
  isMicMuted: boolean
  speakingSet: Set<string> // Set of nullifier hashes currently speaking
  voiceError: string | null
  joinVoice: () => void
  leaveVoice: () => void
  toggleMic: () => void
}

/**
 * Manages LiveKit voice connection for a room.
 * Gracefully no-ops when NEXT_PUBLIC_LIVEKIT_URL is not set.
 */
export function useVoiceRoom(roomId: string, nullifierHash: string | null): UseVoiceRoomReturn {
  const lkUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL

  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [speakingSet, setSpeakingSet] = useState<Set<string>>(new Set())
  const [voiceError, setVoiceError] = useState<string | null>(null)

  const lkRoomRef = useRef<LiveKitRoom | null>(null)

  const leaveVoice = useCallback(() => {
    if (lkRoomRef.current) {
      lkRoomRef.current.disconnect()
      lkRoomRef.current = null
    }
    setVoiceState('idle')
    setSpeakingSet(new Set())
    setIsMicMuted(false)
  }, [])

  // Disconnect on unmount
  useEffect(() => {
    return () => {
      leaveVoice()
    }
  }, [leaveVoice])

  const joinVoice = useCallback(async () => {
    if (!lkUrl || !nullifierHash) return
    if (voiceState === 'connecting' || voiceState === 'connected') return

    setVoiceState('connecting')
    setVoiceError(null)

    let lkRoom: LiveKitRoom | null = null
    try {
      // Fetch a short-lived token from our API
      const res = await fetch(`/api/rooms/${roomId}/voice-token`, { method: 'POST' })
      const json = (await res.json()) as { success: boolean; data?: { token: string }; error?: string }
      if (!json.success || !json.data) {
        setVoiceError(json.error ?? 'Could not get voice access')
        setVoiceState('error')
        return
      }

      lkRoom = new LiveKitRoom({
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
        adaptiveStream: true,
        dynacast: true,
      })
      lkRoomRef.current = lkRoom

      lkRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setSpeakingSet(new Set(speakers.map((s) => s.identity)))
      })

      lkRoom.on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === ConnectionState.Disconnected) {
          setVoiceState('idle')
          setSpeakingSet(new Set())
          lkRoomRef.current = null
        }
      })

      await lkRoom.connect(lkUrl, json.data.token)

      // Enable microphone via the high-level API (handles track creation internally)
      await lkRoom.localParticipant.setMicrophoneEnabled(true)

      setVoiceState('connected')
    } catch (err) {
      console.error('[useVoiceRoom] connect error', err)
      setVoiceError('Could not connect to voice. Check mic permissions.')
      setVoiceState('error')
      lkRoom?.disconnect()
      lkRoomRef.current = null
    }
  }, [lkUrl, nullifierHash, roomId, voiceState])

  const toggleMic = useCallback(() => {
    const lkRoom = lkRoomRef.current
    if (!lkRoom) return
    const next = !isMicMuted
    void lkRoom.localParticipant.setMicrophoneEnabled(!next)
    setIsMicMuted(next)
  }, [isMicMuted])

  return { voiceState, isMicMuted, speakingSet, voiceError, joinVoice, leaveVoice, toggleMic }
}
