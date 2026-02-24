'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Track the latest message timestamp so polling only fetches genuinely new messages
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
  }

  // Poll for new messages every 7 seconds while the conversation is open
  useEffect(() => {
    if (!nullifierHash || !otherHash) return
    const poll = async () => {
      if (!latestMsgAt.current) return
      const theirKey = otherPublicKey
      const myKey = dmPrivateKey
      if (!theirKey || !myKey) return
      try {
        const res = await fetch(
          `/api/dm/messages?otherHash=${encodeURIComponent(otherHash)}&since=${encodeURIComponent(latestMsgAt.current)}`
        )
        const json = (await res.json()) as { success: boolean; data?: import('@/lib/db/dm').RawDmMessage[] }
        if (!json.success || !json.data || json.data.length === 0) return

        const results = await Promise.allSettled(
          json.data.map((msg) =>
            decryptDm(myKey, theirKey, { ciphertext: msg.ciphertext, nonce: msg.nonce })
          )
        )
        const newMsgs = json.data.map((msg, i) => {
          const r = results[i]
          return r?.status === 'fulfilled'
            ? { id: msg.id, senderHash: msg.senderHash, text: r.value, createdAt: new Date(msg.createdAt) }
            : { id: msg.id, senderHash: msg.senderHash, text: '[encrypted]', createdAt: new Date(msg.createdAt), failed: true as const }
        })
        // Oldest-first within the new batch (API returns desc for since-queries too)
        newMsgs.reverse()
        const last = newMsgs[newMsgs.length - 1]
        if (last) latestMsgAt.current = last.createdAt.toISOString()
        setMessages((prev) => [...prev, ...newMsgs])
      } catch { /* ignore network errors during polling */ }
    }
    const id = setInterval(() => void poll(), 7_000)
    return () => clearInterval(id)
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
            <p className="text-text font-semibold mb-2">Not available</p>
            <p className="text-text-secondary text-sm">This person hasn&apos;t set up encrypted messaging yet.</p>
          </div>
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
            {!isLoading && messages.length === 0 && (
              <p className="text-text-muted text-sm text-center py-12">
                Send the first message.
              </p>
            )}
            {messages.map((msg) => {
              const isMe = msg.senderHash === nullifierHash
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? 'bg-accent text-white rounded-br-md'
                      : 'glass rounded-bl-md text-text'
                  } ${msg.failed ? 'opacity-50 italic' : ''}`}>
                    {msg.text}
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
