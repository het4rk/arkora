'use client'

import { useState, useRef } from 'react'

interface RoomComposerProps {
  roomId: string
  isMuted: boolean
  onSent?: () => void
}

export function RoomComposer({ roomId, isMuted, onSent }: RoomComposerProps) {
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function send() {
    const text = draft.trim()
    if (!text || isSending || isMuted) return

    setIsSending(true)
    setSendError(null)
    setDraft('')
    try {
      const res = await fetch(`/api/rooms/${roomId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) throw new Error(`Send failed (${res.status})`)
      onSent?.()
    } catch {
      setDraft(text)
      setSendError('Message failed to send. Try again.')
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  if (isMuted) {
    return (
      <div className="px-4 py-3 text-center text-text-muted text-xs">
        You have been muted by the host
      </div>
    )
  }

  return (
    <div className="px-4 py-3">
      {sendError && (
        <p className="text-[11px] text-text-secondary mb-2 text-center">{sendError}</p>
      )}
      <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, 500))}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
        placeholder="Say something…"
        className="glass-input flex-1 rounded-[var(--r-full)] px-4 py-2.5 text-sm"
      />
      <button
        type="button"
        onClick={() => void send()}
        disabled={!draft.trim() || isSending}
        className="w-10 h-10 bg-accent rounded-full flex items-center justify-center shrink-0 active:scale-95 disabled:opacity-40 transition-all"
        aria-label="Send"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
      </div>
    </div>
  )
}
