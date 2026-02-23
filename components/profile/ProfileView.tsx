'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MiniKit } from '@worldcoin/minikit-js'
import { useArkoraStore } from '@/store/useArkoraStore'
import { HumanBadge } from '@/components/ui/HumanBadge'
import { ProfilePostCard } from './ProfilePostCard'
import { ProfileReplyCard } from './ProfileReplyCard'
import { generateAlias } from '@/lib/session'
import type { Post, Reply } from '@/lib/types'

type Tab = 'posts' | 'replies' | 'votes'

interface VotedPost extends Post { voteDirection: 1 | -1 }
interface ReplyWithTitle extends Reply { postTitle: string | null }

export function ProfileView() {
  const router = useRouter()
  const { nullifierHash, isVerified, identityMode, persistentAlias, user } = useArkoraStore()
  const [tab, setTab] = useState<Tab>('posts')
  const [posts, setPosts] = useState<Post[]>([])
  const [replies, setReplies] = useState<ReplyWithTitle[]>([])
  const [votes, setVotes] = useState<VotedPost[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function displayName(): string {
    if (identityMode === 'alias') {
      return persistentAlias ?? (nullifierHash ? generateAlias(nullifierHash) : '…')
    }
    if (identityMode === 'named') {
      const username = MiniKit.isInstalled() ? (MiniKit.user?.username ?? null) : null
      return username ?? user?.pseudoHandle ?? 'World ID user'
    }
    return 'Anonymous'
  }

  useEffect(() => {
    if (!nullifierHash || !isVerified) return
    void fetchTab(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, nullifierHash, isVerified])

  async function fetchTab(t: Tab) {
    if (!nullifierHash) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/profile?nullifierHash=${encodeURIComponent(nullifierHash)}&tab=${t}`)
      const json = (await res.json()) as { success: boolean; data?: { items: unknown[] }; error?: string }
      if (!json.success) throw new Error(json.error ?? 'Failed to load')

      if (t === 'posts') setPosts(json.data!.items as Post[])
      else if (t === 'replies') setReplies(json.data!.items as ReplyWithTitle[])
      else if (t === 'votes') setVotes(json.data!.items as VotedPost[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isVerified || !nullifierHash) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-8 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <p className="font-bold text-text text-xl mb-2">Profile locked</p>
        <p className="text-text-secondary text-sm">Verify with World ID to see your profile.</p>
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'posts', label: 'Posts' },
    { id: 'replies', label: 'Replies' },
    { id: 'votes', label: 'Voted' },
  ]

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <div className="px-[5vw] pt-[max(env(safe-area-inset-top),20px)] pb-0">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-text-muted text-sm font-medium active:opacity-60 transition-opacity mb-5"
        >
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 1L1 6l5 5" />
          </svg>
          Back
        </button>

        {/* Identity card */}
        <div className="glass rounded-[var(--r-xl)] px-5 py-5 mb-5">
          <div className="flex items-center gap-3 mb-3">
            <HumanBadge label={displayName()} size="lg" />
          </div>
          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span>{posts.length} posts</span>
            <span className="opacity-40">·</span>
            <span>{replies.length} replies</span>
          </div>
          <p className="text-text-muted/50 text-[11px] mt-3 leading-relaxed">
            Your anonymous/alias posts are only visible to you here.
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-[var(--r-md)] transition-all ${
                tab === t.id
                  ? 'bg-accent text-white'
                  : 'text-text-muted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-[5vw] py-4 pb-[max(env(safe-area-inset-bottom),80px)] space-y-3">
        {isLoading && (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass rounded-[var(--r-lg)] h-20" />
            ))}
          </div>
        )}

        {error && (
          <p className="text-downvote text-sm text-center py-8">{error}</p>
        )}

        {!isLoading && !error && tab === 'posts' && (
          posts.length === 0
            ? <p className="text-text-muted text-sm text-center py-12">No posts yet.</p>
            : posts.map((post) => (
                <ProfilePostCard
                  key={post.id}
                  post={post}
                  onDeleted={(id) => setPosts((p) => p.filter((x) => x.id !== id))}
                />
              ))
        )}

        {!isLoading && !error && tab === 'replies' && (
          replies.length === 0
            ? <p className="text-text-muted text-sm text-center py-12">No replies yet.</p>
            : replies.map((reply) => (
                <ProfileReplyCard
                  key={reply.id}
                  reply={reply}
                  onDeleted={(id) => setReplies((r) => r.filter((x) => x.id !== id))}
                />
              ))
        )}

        {!isLoading && !error && tab === 'votes' && (
          votes.length === 0
            ? <p className="text-text-muted text-sm text-center py-12">No votes yet.</p>
            : votes.map((post) => (
                <div key={post.id} className="relative">
                  <div className={`absolute top-3 right-3 z-10 text-xs font-bold ${post.voteDirection === 1 ? 'text-upvote' : 'text-downvote'}`}>
                    {post.voteDirection === 1 ? '↑' : '↓'}
                  </div>
                  <ProfilePostCard post={post} />
                </div>
              ))
        )}
      </div>
    </div>
  )
}
