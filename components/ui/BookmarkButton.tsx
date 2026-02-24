'use client'

import { useState, useEffect } from 'react'
import { useArkoraStore } from '@/store/useArkoraStore'
import { haptic } from '@/lib/utils'

interface Props {
  postId: string
  initialBookmarked?: boolean
  className?: string | undefined
}

export function BookmarkButton({ postId, initialBookmarked, className }: Props) {
  const { nullifierHash, isVerified, setVerifySheetOpen } = useArkoraStore()
  const [bookmarked, setBookmarked] = useState(initialBookmarked ?? false)
  const [loading, setLoading] = useState(false)

  // Only fetch on mount when the parent hasn't pre-fetched the state
  useEffect(() => {
    if (initialBookmarked !== undefined || !nullifierHash) return
    void fetch(`/api/bookmarks?postId=${encodeURIComponent(postId)}`)
      .then((r) => r.json())
      .then((j: { success: boolean; data?: { isBookmarked: boolean } }) => {
        if (j.success && j.data) setBookmarked(j.data.isBookmarked)
      })
      .catch(() => null)
  }, [nullifierHash, postId, initialBookmarked])

  async function toggle() {
    if (!isVerified || !nullifierHash) {
      setVerifySheetOpen(true)
      return
    }
    haptic('light')
    const next = !bookmarked
    setBookmarked(next) // optimistic
    setLoading(true)
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      })
      const json = (await res.json()) as { success: boolean; data?: { isBookmarked: boolean } }
      if (json.success && json.data) setBookmarked(json.data.isBookmarked)
      else setBookmarked(!next) // revert
    } catch {
      setBookmarked(!next)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); void toggle() }}
      disabled={loading}
      aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark'}
      className={`text-text-muted transition-all active:scale-90 disabled:opacity-40 ${className ?? ''}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={bookmarked ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        className={bookmarked ? 'text-accent' : 'text-text-muted'}>
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  )
}
