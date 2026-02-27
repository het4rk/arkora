'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useArkoraStore } from '@/store/useArkoraStore'
import { Avatar } from '@/components/ui/Avatar'
import { generateDmKeyPair } from '@/lib/crypto/dm'
import type { ConversationSummary } from '@/lib/db/dm'

function TimeAgoShort({ date }: { date: Date }) {
  const d = new Date(date)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return <span>now</span>
  if (diff < 3600) return <span>{Math.floor(diff / 60)}m</span>
  if (diff < 86400) return <span>{Math.floor(diff / 3600)}h</span>
  return <span>{Math.floor(diff / 86400)}d</span>
}

export function ConversationList() {
  const router = useRouter()
  const { nullifierHash, isVerified, dmPrivateKey, setDmPrivateKey, setVerifySheetOpen } = useArkoraStore()
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  // On mount: ensure the user has a DM key pair generated and registered
  useEffect(() => {
    if (!isVerified || !nullifierHash) return
    void initKeys()
    void fetchConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nullifierHash, isVerified])

  async function initKeys() {
    if (!nullifierHash) return
    let privateKey = dmPrivateKey
    if (!privateKey) {
      // Generate a new key pair
      const pair = generateDmKeyPair()
      privateKey = pair.privateKeyB64
      setDmPrivateKey(privateKey)
      // Register public key with server
      await fetch('/api/dm/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey: pair.publicKeyB64 }),
      })
    }
  }

  async function fetchConversations() {
    if (!nullifierHash) return
    setError(false)
    try {
      const res = await fetch('/api/dm/conversations')
      const json = (await res.json()) as { success: boolean; data?: ConversationSummary[] }
      if (json.success && json.data) setConversations(json.data)
      else if (!json.success) setError(true)
    } catch {
      setError(true)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isVerified || !nullifierHash) {
    return (
      <div className="flex-1 flex items-center justify-center px-8 text-center py-16">
        <div>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted mb-4"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          <p className="font-bold text-text text-lg mb-2">Verify to use DMs</p>
          <p className="text-text-secondary text-sm mb-5">Messages are end-to-end encrypted.</p>
          <button
            onClick={() => setVerifySheetOpen(true)}
            className="px-6 py-3 bg-accent text-background text-sm font-semibold rounded-[var(--r-full)] active:scale-95 transition-all"
          >
            Verify with World ID
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex-1 px-[5vw] py-4 space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <div className="w-10 h-10 rounded-full bg-surface-up shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-28 bg-surface-up rounded" />
              <div className="h-3 w-40 bg-surface-up rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 px-8 text-center">
        <p className="text-text font-semibold mb-2">Could not load messages</p>
        <p className="text-text-muted text-sm mb-5">Check your connection and try again.</p>
        <button
          type="button"
          onClick={() => { setIsLoading(true); void fetchConversations() }}
          className="px-5 py-2.5 bg-accent text-background text-sm font-semibold rounded-[var(--r-lg)] active:scale-95 transition-all"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted mb-4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          <p className="font-bold text-text text-lg mb-2">No messages yet</p>
          <p className="text-text-secondary text-sm">
            Visit someone&apos;s profile to send them a message.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/20">
          {conversations.map((conv) => (
            <button
              key={conv.otherHash}
              onClick={() => router.push(`/dm/${conv.otherHash}`)}
              className="w-full flex items-center gap-3 px-[5vw] py-4 active:bg-surface-up/50 transition-colors text-left"
            >
              <Avatar
                avatarUrl={conv.otherAvatarUrl}
                label={conv.otherHandle ?? conv.otherHash.slice(-6)}
                size="md"
                className="shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-text text-sm font-semibold truncate">
                    {conv.otherHandle ?? `Human #${conv.otherHash.slice(-6)}`}
                  </span>
                  <span className="text-text-muted text-[11px] shrink-0 ml-2">
                    <TimeAgoShort date={conv.lastMessageAt} />
                  </span>
                </div>
                <p className="text-text-muted text-xs truncate">
                  {conv.lastSenderHash === nullifierHash ? 'You: ' : ''}
                  <span className="italic opacity-60">encrypted message</span>
                </p>
              </div>
              <svg width="6" height="10" viewBox="0 0 6 10" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                className="text-text-muted/40 shrink-0">
                <path d="M1 1l4 4-4 4" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
