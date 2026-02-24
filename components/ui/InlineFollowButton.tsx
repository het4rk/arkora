'use client'

import { useState, useEffect } from 'react'
import { useArkoraStore } from '@/store/useArkoraStore'
import { haptic } from '@/lib/utils'

interface Props {
  targetHash: string
}

/**
 * Small inline "Follow / Following" pill shown next to a HumanBadge
 * in thread views and reply cards — follows the X pattern.
 *
 * Lazily fetches follow status on mount so it doesn't block rendering.
 * Hidden while loading and hidden on own posts.
 */
export function InlineFollowButton({ targetHash }: Props) {
  const { nullifierHash, isVerified, setVerifySheetOpen } = useArkoraStore()
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null) // null = loading
  const [isLoading, setIsLoading] = useState(false)

  // Don't render for own posts
  if (nullifierHash === targetHash) return null

  useEffect(() => {
    if (!nullifierHash) return
    void fetch(
      `/api/follow?nullifierHash=${encodeURIComponent(targetHash)}`
    )
      .then((r) => r.json())
      .then((j: { success: boolean; data?: { isFollowing: boolean } }) => {
        if (j.success && j.data) setIsFollowing(j.data.isFollowing)
      })
      .catch(() => null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetHash, nullifierHash])

  // Still loading — render nothing to avoid layout shift
  if (isFollowing === null) return null

  async function handleFollow(e: React.MouseEvent) {
    e.stopPropagation()
    if (!isVerified || !nullifierHash) {
      setVerifySheetOpen(true)
      return
    }
    haptic('light')
    setIsLoading(true)
    const optimistic = !isFollowing
    setIsFollowing(optimistic)
    try {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followedId: targetHash }),
      })
      const json = (await res.json()) as { success: boolean; data?: { isFollowing: boolean } }
      if (json.success && json.data) setIsFollowing(json.data.isFollowing)
      else setIsFollowing(!optimistic)
    } catch {
      setIsFollowing(!optimistic)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={(e) => void handleFollow(e)}
      disabled={isLoading}
      className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all active:scale-95 disabled:opacity-50 ${
        isFollowing
          ? 'border border-accent/40 text-accent bg-accent/5'
          : 'bg-accent text-white shadow-sm shadow-accent/20'
      }`}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </button>
  )
}
