'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useArkoraStore } from '@/store/useArkoraStore'
import { TimeAgo } from '@/components/ui/TimeAgo'
import type { EnrichedNotification, Notification } from '@/lib/types'

const TYPE_LABELS: Record<Notification['type'], string> = {
  reply: 'replied to your post',
  follow: 'started following you',
  dm: 'sent you a message',
  like: 'upvoted your post',
  quote: 'quoted your post',
  repost: 'reposted your post',
  mention: 'mentioned you',
}

const TYPE_ICONS: Record<Notification['type'], JSX.Element> = {
  reply: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  follow: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>,
  dm: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>,
  like: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>,
  quote: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 11h-4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4" /><path d="M20 11h-4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4" /></svg>,
  repost: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>,
  mention: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" /></svg>,
}

type FilterType = 'all' | Notification['type']

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'like', label: 'Likes' },
  { id: 'reply', label: 'Replies' },
  { id: 'quote', label: 'Quotes' },
  { id: 'follow', label: 'Follows' },
  { id: 'dm', label: 'DMs' },
]

export function NotificationList() {
  const router = useRouter()
  const { nullifierHash, isVerified, setUnreadNotificationCount } = useArkoraStore()
  const [notifications, setNotifications] = useState<EnrichedNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')

  useEffect(() => {
    if (!nullifierHash || !isVerified) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nullifierHash, isVerified])

  async function load() {
    if (!nullifierHash) return
    try {
      const res = await fetch('/api/notifications')
      const json = (await res.json()) as { success: boolean; data?: { notifications: EnrichedNotification[]; unreadCount: number } }
      if (json.success && json.data) setNotifications(json.data.notifications)
      // Mark all as read after viewing
      void fetch('/api/notifications', { method: 'POST' })
        .then(() => setUnreadNotificationCount(0))
    } finally {
      setIsLoading(false)
    }
  }

  function handleTap(n: EnrichedNotification) {
    if ((n.type === 'reply' || n.type === 'quote' || n.type === 'repost' || n.type === 'like') && n.referenceId) {
      router.push(`/post/${n.referenceId}`)
    } else if (n.type === 'dm' && n.actorHash) {
      router.push(`/dm/${n.actorHash}`)
    } else if (n.type === 'follow' && n.actorHash) {
      router.push(`/u/${n.actorHash}`)
    }
  }

  if (!isVerified || !nullifierHash) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
        Verify with World ID to see notifications.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-5 space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-[var(--r-lg)] h-16" />
        ))}
      </div>
    )
  }

  const visible = filter === 'all' ? notifications : notifications.filter((n) => n.type === filter)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Filter tabs */}
      <div className="flex gap-1.5 px-[5vw] pt-3 pb-2 overflow-x-auto no-scrollbar shrink-0">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 px-3.5 py-1.5 rounded-[var(--r-full)] text-xs font-semibold transition-all active:scale-95 ${
              filter === f.id
                ? 'bg-accent text-background shadow-sm shadow-accent/30'
                : 'glass text-text-secondary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-16">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted mb-4"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
          <p className="font-semibold text-text mb-1">
            {filter === 'all' ? 'All caught up' : `No ${FILTERS.find((f) => f.id === filter)?.label.toLowerCase() ?? ''} yet`}
          </p>
          <p className="text-text-muted text-sm">New replies, follows and DMs will appear here.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-[5vw] py-2 pb-[max(env(safe-area-inset-bottom),80px)] space-y-2">
          {visible.map((n) => (
            <button
              key={n.id}
              onClick={() => handleTap(n)}
              className={`w-full text-left glass rounded-[var(--r-lg)] px-4 py-3.5 flex items-start gap-3 active:opacity-70 transition-opacity ${
                !n.read ? 'border border-accent/20' : ''
              }`}
            >
              <div className="shrink-0 mt-0.5 text-text-muted">{TYPE_ICONS[n.type] ?? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>}</div>
              <div className="flex-1 min-w-0">
                <p className="text-text text-sm leading-snug">
                  <span className="font-semibold">{n.actorDisplay ?? 'Someone'}</span>
                  {' '}{TYPE_LABELS[n.type] ?? 'interacted with your post'}
                </p>
                <TimeAgo date={n.createdAt} className="mt-1" />
              </div>
              {!n.read && (
                <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
