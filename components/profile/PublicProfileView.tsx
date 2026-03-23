'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useArkoraStore } from '@/store/useArkoraStore'
import { Avatar } from '@/components/ui/Avatar'
import { HumanBadge } from '@/components/ui/HumanBadge'
import { KarmaBadge } from '@/components/ui/KarmaBadge'
import { ProfilePostCard } from './ProfilePostCard'
import { AnimatePresence } from 'framer-motion'
import { TipModal } from '@/components/ui/TipModal'
import { SubscribeModal } from '@/components/ui/SubscribeModal'
import { haptic, formatDisplayName } from '@/lib/utils'
import { ShareSheet } from '@/components/ui/ShareSheet'
import type { Post, HumanUser } from '@/lib/types'
import { authFetch } from '@/lib/authFetch'
import Link from 'next/link'

interface ProfileData {
  user: HumanUser | null
  profileAvailable?: boolean
  posts: Post[]
  followerCount: number
  followingCount: number
  postCount: number
  isFollowing: boolean
  subscriberCount: number
  isSubscribed: boolean
  subscriptionDaysLeft: number | null
  tipTotalReceived: number
}

interface Props {
  nullifierHash: string
}

export function PublicProfileView({ nullifierHash }: Props) {
  const router = useRouter()
  const { nullifierHash: viewerHash, isVerified, setVerifySheetOpen, identityMode: viewerMode } = useArkoraStore()
  const [data, setData] = useState<ProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [tipOpen, setTipOpen] = useState(false)
  const [subOpen, setSubOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const isOwnProfile = viewerHash === nullifierHash

  const fetchProfile = useCallback(async () => {
    try {
      const res = await authFetch(`/api/u/${encodeURIComponent(nullifierHash)}`)
      const json = (await res.json()) as { success: boolean; data?: ProfileData }
      if (json.success && json.data) setData(json.data)
    } finally {
      setIsLoading(false)
    }
  }, [nullifierHash])

  useEffect(() => { void fetchProfile() }, [fetchProfile])

  async function handleFollow() {
    if (!isVerified || !viewerHash) { setVerifySheetOpen(true); return }
    haptic('light')
    setFollowLoading(true)
    try {
      const res = await authFetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followedId: nullifierHash }),
      })
      const json = (await res.json()) as { success: boolean; data?: { isFollowing: boolean } }
      if (json.success && json.data && data) {
        const nowFollowing = json.data.isFollowing
        setData({
          ...data,
          isFollowing: nowFollowing,
          followerCount: data.followerCount + (nowFollowing ? 1 : -1),
        })
      }
    } finally {
      setFollowLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background p-5 animate-pulse space-y-4">
        <div className="h-5 w-24 bg-surface-up rounded-full" />
        <div className="h-20 bg-surface-up rounded-2xl" />
        <div className="h-6 w-32 bg-surface-up rounded-full" />
      </div>
    )
  }

  // Profile not available for non-named users
  if (data && data.profileAvailable === false) {
    return (
      <div className="min-h-dvh bg-background flex flex-col">
        <div className="px-[5vw] pt-[max(env(safe-area-inset-top),20px)] pb-2">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-text-muted text-sm font-medium active:opacity-60 transition-opacity"
          >
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 1L1 6l5 5" />
            </svg>
            Back
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center px-[5vw]">
          <div className="glass rounded-[var(--r-xl)] px-6 py-8 text-center max-w-sm">
            <p className="text-text font-semibold text-lg mb-2">Profile not available</p>
            <p className="text-text-muted text-sm">This user is not in named mode. Only named profiles are publicly visible.</p>
          </div>
        </div>
      </div>
    )
  }

  const displayName = data?.user?.pseudoHandle ? formatDisplayName(data.user.pseudoHandle) : `Human #${nullifierHash.slice(-6)}`
  const wallet = data?.user?.walletAddress

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <div className="flex-1 overflow-y-auto pb-[max(env(safe-area-inset-bottom),80px)]">

        {/* Back */}
        <div className="px-[5vw] pt-[max(env(safe-area-inset-top),20px)] pb-2">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-text-muted text-sm font-medium active:opacity-60 transition-opacity"
          >
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 1L1 6l5 5" />
            </svg>
            Back
          </button>
        </div>

        {/* Profile card */}
        <div className="px-[5vw] py-4">
          <div className="glass rounded-[var(--r-xl)] px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar
                  avatarUrl={data?.user?.avatarUrl ?? null}
                  label={displayName}
                  size="lg"
                  className="shrink-0"
                />
                <div className="min-w-0 flex flex-col gap-1">
                  <HumanBadge label={displayName} size="lg" />
                  {data?.user && <KarmaBadge score={data.user.karmaScore} showScore />}
                  {data?.user?.worldIdVerified && wallet && !wallet.startsWith('idkit_') ? (
                    <a
                      href={`https://worldscan.org/address/${wallet}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-accent/70 hover:text-accent transition-colors leading-none"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                      Verified on World Chain
                    </a>
                  ) : data?.user?.worldIdVerified ? (
                    <span className="flex items-center gap-1 text-[10px] text-accent/70 leading-none">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      Verified on World Chain
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Action buttons - hidden on own profile. Follow/DM require named mode for both parties. */}
              {!isOwnProfile && (
                <div className="shrink-0 flex flex-col gap-2">
                  {viewerMode === 'named' && (
                    <button
                      onClick={() => void handleFollow()}
                      disabled={followLoading}
                      className={`px-4 py-2 rounded-[var(--r-full)] text-sm font-semibold transition-all active:scale-95 disabled:opacity-40 ${
                        data?.isFollowing
                          ? 'glass border border-accent/30 text-accent'
                          : 'bg-accent text-background shadow-sm shadow-accent/30'
                      }`}
                    >
                      {data?.isFollowing ? 'Following' : 'Follow'}
                    </button>
                  )}
                  {viewerMode === 'named' && (
                    <Link
                      href={`/dm/${nullifierHash}`}
                      onClick={() => haptic('light')}
                      className="px-4 py-2 glass rounded-[var(--r-full)] text-sm font-semibold text-text-muted text-center transition-all active:scale-95"
                    >
                      Message
                    </Link>
                  )}
                  {/* Tip button - visible to alias and named viewers */}
                  {viewerMode !== 'anonymous' && (
                    <button
                      onClick={() => { haptic('light'); setTipOpen(true) }}
                      className="px-4 py-2 glass rounded-[var(--r-full)] text-sm font-semibold text-text-muted text-center transition-all active:scale-95"
                    >
                      Tip WLD
                    </button>
                  )}
                  {/* Subscribe - both parties must be named */}
                  {viewerMode === 'named' && data?.user?.identityMode === 'named' && (
                    <button
                      onClick={() => {
                        if (!isVerified || !viewerHash) { setVerifySheetOpen(true); return }
                        haptic('light')
                        setSubOpen(true)
                      }}
                      className={`px-4 py-2 rounded-[var(--r-full)] text-sm font-semibold transition-all active:scale-95 ${
                        data?.isSubscribed
                          ? 'glass border border-accent/40 text-accent'
                          : 'glass border border-border text-text-muted'
                      }`}
                    >
                      {data?.isSubscribed
                        ? `Subscribed · ${data.subscriptionDaysLeft ?? '?'}d`
                        : 'Subscribe · 1 WLD/mo'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 mt-4 text-xs text-text-muted flex-wrap">
              <span><span className="text-text font-semibold">{data?.followerCount ?? 0}</span> followers</span>
              <span><span className="text-text font-semibold">{data?.followingCount ?? 0}</span> following</span>
              <span><span className="text-text font-semibold">{data?.postCount ?? 0}</span> posts</span>
              {(data?.tipTotalReceived ?? 0) > 0 && (
                <span><span className="text-text font-semibold">{data!.tipTotalReceived.toFixed(2)}</span> WLD received</span>
              )}
            </div>

            {/* Bio */}
            {data?.user?.bio && (
              <p className="text-text-secondary text-sm mt-3 leading-relaxed">{data.user.bio}</p>
            )}

            {/* Share profile */}
            <button
              onClick={() => {
                haptic('light')
                setShareOpen(true)
              }}
              className="mt-4 flex items-center gap-1.5 text-text-muted text-xs font-medium active:opacity-60 transition-opacity"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              Share profile
            </button>
          </div>
        </div>

        {/* Posts */}
        <div className="px-[5vw] space-y-3 pb-4">
          {data?.posts.length === 0 && (
            <p className="text-text-muted text-sm text-center py-12">No public posts yet.</p>
          )}
          {data?.posts.map((post) => (
            <ProfilePostCard key={post.id} post={post} />
          ))}
        </div>
      </div>

      {/* Modals - wrapped in AnimatePresence for spring exit animation */}
      <AnimatePresence>
        {tipOpen && (
          <TipModal
            recipientHash={nullifierHash}
            recipientName={displayName}
            recipientWallet={wallet ?? undefined}
            onClose={() => setTipOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {subOpen && wallet && (
          <SubscribeModal
            creatorHash={nullifierHash}
            creatorName={displayName}
            creatorWallet={wallet}
            isSubscribed={data?.isSubscribed ?? false}
            daysLeft={data?.subscriptionDaysLeft ?? null}
            onClose={() => setSubOpen(false)}
            onSubscribed={(daysLeft) => {
              if (!data) return
              setData({
                ...data,
                isSubscribed: true,
                subscriptionDaysLeft: daysLeft,
                subscriberCount: data.isSubscribed ? data.subscriberCount : data.subscriberCount + 1,
              })
            }}
            onCancelled={() => {
              if (!data) return
              setData({
                ...data,
                isSubscribed: false,
                subscriptionDaysLeft: null,
                subscriberCount: Math.max(0, data.subscriberCount - 1),
              })
            }}
          />
        )}
      </AnimatePresence>

      <ShareSheet
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        url={`${typeof window !== 'undefined' ? window.location.origin : ''}/u/${nullifierHash}`}
        title={displayName}
        text={`Check out ${displayName} on Arkora - the provably human message board.`}
      />
    </div>
  )
}
