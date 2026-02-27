'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Pusher from 'pusher-js'
import { useArkoraStore } from '@/store/useArkoraStore'
import { Avatar } from '@/components/ui/Avatar'
import { encryptDm, decryptDm, generateDmKeyPair } from '@/lib/crypto/dm'
import { haptic, formatDisplayName } from '@/lib/utils'
import type { RawDmMessage } from '@/lib/db/dm'

interface DecryptedMessage {
  id: string
  senderHash: string
  text: string
  createdAt: Date
  failed?: boolean
}

interface Props {
  otherHash: string
}

export function ConversationView({ otherHash }: Props) {
  const router = useRouter()
  const { nullifierHash, isVerified, dmPrivateKey, setDmPrivateKey } = useArkoraStore()
  const [messages, setMessages] = useState<DecryptedMessage[]>([])
  const [otherPublicKey, setOtherPublicKey] = useState<string | null>(null)
  const [otherHandle, setOtherHandle] = useState<string | null>(null)
  const [otherAvatarUrl, setOtherAvatarUrl] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [noKey, setNoKey] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [connectionLost, setConnectionLost] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Track the latest message timestamp for the Pusher duplicate-guard
  const latestMsgAt = useRef<string | null>(null)

  const ensureOwnKey = useCallback(async (): Promise<string | null> => {
    if (!nullifierHash) return null
    if (dmPrivateKey) return dmPrivateKey
    // Generate fresh key pair
    const pair = generateDmKeyPair()
    setDmPrivateKey(pair.privateKeyB64)
    await fetch('/api/dm/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKey: pair.publicKeyB64 }),
    })
    return pair.privateKeyB64
  }, [nullifierHash, dmPrivateKey, setDmPrivateKey])

  useEffect(() => {
    if (!nullifierHash) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nullifierHash, otherHash])

  async function load() {
    if (!nullifierHash) return
    setIsLoading(true)
    setLoadError(false)

    try {
    const [keyRes, profileRes, msgsRes] = await Promise.all([
      fetch(`/api/dm/keys?nullifierHash=${encodeURIComponent(otherHash)}`),
      fetch(`/api/u/${encodeURIComponent(otherHash)}`),
      fetch(`/api/dm/messages?otherHash=${encodeURIComponent(otherHash)}`),
    ])

    const keyJson = (await keyRes.json()) as { success: boolean; data?: { publicKey: string } }
    const profileJson = (await profileRes.json()) as { success: boolean; data?: { user: { pseudoHandle?: string | null; avatarUrl?: string | null } } }
    const msgsJson = (await msgsRes.json()) as { success: boolean; data?: RawDmMessage[] }

    if (!keyJson.success || !keyJson.data) {
      setNoKey(true)
      setIsLoading(false)
      return
    }

    const theirPublicKey = keyJson.data.publicKey
    setOtherPublicKey(theirPublicKey)
    if (profileJson.success && profileJson.data?.user) {
      setOtherHandle(profileJson.data.user.pseudoHandle ?? null)
      setOtherAvatarUrl(profileJson.data.user.avatarUrl ?? null)
    }

    const myPrivateKey = await ensureOwnKey()

    // Decrypt all messages in parallel — ECDH is symmetric so both sides
    // derive the same shared secret (own private key + other's public key).
    const rawMsgs = msgsJson.data ?? []
    const results = await Promise.allSettled(
      rawMsgs.map((msg) =>
        myPrivateKey
          ? decryptDm(myPrivateKey, theirPublicKey, { ciphertext: msg.ciphertext, nonce: msg.nonce })
          : Promise.reject(new Error('no key'))
      )
    )
    const decrypted: DecryptedMessage[] = rawMsgs.map((msg, i) => {
      const result = results[i]
      return result?.status === 'fulfilled'
        ? { id: msg.id, senderHash: msg.senderHash, text: result.value, createdAt: new Date(msg.createdAt) }
        : { id: msg.id, senderHash: msg.senderHash, text: '[encrypted]', createdAt: new Date(msg.createdAt), failed: true }
    })

    // Reverse to show oldest first; track latest timestamp for polling
    const chronological = decrypted.reverse()
    if (chronological.length > 0) {
      latestMsgAt.current = new Date(chronological[chronological.length - 1]!.createdAt).toISOString()
    }
    setMessages(chronological)
    setIsLoading(false)
    } catch {
      setLoadError(true)
      setIsLoading(false)
    }
  }

  // Subscribe to Pusher for real-time incoming messages (replaces 7s polling)
  useEffect(() => {
    if (!nullifierHash || !otherHash || !otherPublicKey || !dmPrivateKey) return

    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER
    if (!pusherKey || !pusherCluster) return
    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
      channelAuthorization: { endpoint: '/api/pusher/auth', transport: 'ajax' },
    })
    const channel = pusher.subscribe(`private-user-${nullifierHash}`)

    channel.bind('pusher:subscription_error', () => {
      setConnectionLost(true)
    })

    channel.bind('new-dm', async (data: { id: string; senderHash: string; ciphertext: string; nonce: string; createdAt: string }) => {
      // Ignore messages from other conversations (this channel receives all DMs for this user)
      if (data.senderHash !== otherHash) return
      try {
        const text = await decryptDm(dmPrivateKey, otherPublicKey, { ciphertext: data.ciphertext, nonce: data.nonce })
        const msg: DecryptedMessage = {
          id: data.id,
          senderHash: data.senderHash,
          text,
          createdAt: new Date(data.createdAt),
        }
        setMessages((prev) => {
          // Guard against duplicates (e.g. if own send already added it optimistically)
          if (prev.some((m) => m.id === msg.id)) return prev
          return [...prev, msg]
        })
        latestMsgAt.current = data.createdAt
      } catch { /* decryption failure — silently ignore */ }
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(`private-user-${nullifierHash}`)
      pusher.disconnect()
    }
  }, [nullifierHash, otherHash, otherPublicKey, dmPrivateKey])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [messages])

  async function sendMessage() {
    if (!draft.trim() || !nullifierHash || !otherPublicKey || isSending) return
    haptic('light')
    const text = draft.trim()
    setDraft('')

    const myPrivateKey = await ensureOwnKey()
    if (!myPrivateKey) return

    setIsSending(true)
    try {
      const encrypted = await encryptDm(myPrivateKey, otherPublicKey, text)
      const res = await fetch('/api/dm/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientHash: otherHash,
          ciphertext: encrypted.ciphertext,
          nonce: encrypted.nonce,
        }),
      })
      const json = (await res.json()) as { success: boolean; data?: { id: string } }
      if (json.success && json.data) {
        setMessages((prev) => [...prev, {
          id: json.data!.id,
          senderHash: nullifierHash,
          text,
          createdAt: new Date(),
        }])
      }
    } finally {
      setIsSending(false)
    }
  }

  const displayName = otherHandle ? formatDisplayName(otherHandle) : `Human #${otherHash.slice(-6)}`

  if (!isVerified || !nullifierHash) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <p className="text-text-muted">Verify to use DMs.</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <div className="px-[5vw] pt-[max(env(safe-area-inset-top),16px)] pb-3 border-b border-border/25 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-text-muted active:opacity-60 transition-opacity"
        >
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 1L1 6l5 5" />
          </svg>
        </button>
        <Avatar avatarUrl={otherAvatarUrl} label={displayName} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-text font-semibold text-sm truncate">{displayName}</p>
          <p className="text-text-muted text-[10px]">End-to-end encrypted ✓</p>
        </div>
      </div>

      {/* No key registered */}
      {noKey && (
        <div className="flex-1 flex items-center justify-center px-8 text-center py-16">
          <div>
            <p className="text-3xl mb-3">🔑</p>
            <p className="text-text font-semibold mb-2">DMs not available</p>
            <p className="text-text-secondary text-sm">This person hasn&apos;t enabled encrypted messaging yet. Ask them to open Arkora in World App to activate DMs.</p>
          </div>
        </div>
      )}

      {/* Pusher connection lost banner */}
      {connectionLost && !noKey && (
        <div className="px-[5vw] py-2 bg-downvote/10 border-b border-downvote/20 text-center">
          <p className="text-downvote text-xs">Connection lost — new messages may not arrive. Refresh to reconnect.</p>
        </div>
      )}

      {/* Messages */}
      {!noKey && (
        <>
          <div className="flex-1 overflow-y-auto px-[5vw] py-4 space-y-2 pb-32">
            {isLoading && (
              <div className="space-y-3 animate-pulse py-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                    <div className="h-8 w-40 bg-surface-up rounded-2xl" />
                  </div>
                ))}
              </div>
            )}
            {!isLoading && loadError && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-text font-semibold mb-2">Could not load messages</p>
                <p className="text-text-muted text-sm mb-5">Check your connection and try again.</p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="px-5 py-2.5 bg-accent text-white text-sm font-semibold rounded-[var(--r-lg)] active:scale-95 transition-all"
                >
                  Retry
                </button>
              </div>
            )}
            {!isLoading && !loadError && messages.length === 0 && (
              <p className="text-text-muted text-sm text-center py-12">
                Send the first message.
              </p>
            )}
            {!isLoading && !loadError && messages.some((m) => m.failed) && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-up/60 border border-border/30 text-[11px] text-text-muted mb-1">
                <span>Some messages could not be decrypted.</span>
                <button
                  onClick={() => void load()}
                  className="text-accent font-semibold shrink-0 active:opacity-60 transition-opacity"
                >
                  Reload
                </button>
              </div>
            )}
            {messages.map((msg) => {
              const isMe = msg.senderHash === nullifierHash
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? 'bg-accent text-white rounded-br-md'
                      : 'glass rounded-bl-md text-text'
                  } ${msg.failed ? 'opacity-40 italic' : ''}`}>
                    {msg.failed ? 'Unable to decrypt' : msg.text}
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="fixed bottom-0 left-0 right-0 px-[5vw] pb-[max(env(safe-area-inset-bottom),16px)] pt-3 bg-background/80 backdrop-blur-xl border-t border-border/25">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage() }
                }}
                placeholder="Message…"
                rows={1}
                className="glass-input flex-1 rounded-[var(--r-lg)] px-4 py-3 text-[15px] resize-none leading-relaxed max-h-32"
                style={{ overflowY: draft.split('\n').length > 3 ? 'scroll' : 'hidden' }}
              />
              <button
                onClick={() => void sendMessage()}
                disabled={!draft.trim() || isSending || !otherPublicKey}
                className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all shrink-0"
                aria-label="Send"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
