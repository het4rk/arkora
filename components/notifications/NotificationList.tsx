'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useArkoraStore } from '@/store/useArkoraStore'
import { TimeAgo } from '@/components/ui/TimeAgo'
import type { Notification } from '@/lib/types'

const TYPE_LABELS: Record<Notification['type'], string> = {
  reply: 'replied to your post',
  follow: 'started following you',
  dm: 'sent you a message',
  mention: 'mentioned you',
}

const TYPE_ICONS: Record<Notification['type'], string> = {
  reply: '💬',
  follow: '👤',
  dm: '✉️',
  mention: '@',
}

type FilterType = 'all' | Notification['type']

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'reply', label: 'Replies' },
  { id: 'mention', label: 'Mentions' },
  { id: 'follow', label: 'Follows' },
  { id: 'dm', label: 'DMs' },
]

export function NotificationList() {
  const router = useRouter()
  const { nullifierHash, isVerified, setUnreadNotificationCount } = useArkoraStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
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
      const json = (await res.json()) as { success: boolean; data?: Notification[] }
      if (json.success && json.data) setNotifications(json.data)
      // Mark all as read after viewing
      void fetch('/api/notifications', { method: 'POST' })
        .then(() => setUnreadNotificationCount(0))
    } finally {
      setIsLoading(false)
    }
  }

  function handleTap(n: Notification) {
    if (n.type === 'reply' && n.referenceId) {
      router.push(`/post/${n.referenceId}`)
    } else if (n.type === 'dm' && n.actorHash) {
      router.push(`/dm/${n.actorHash}`)
    } else if (n.type === 'follow' && n.actorHash) {
      router.push(`/u/${n.actorHash}`)
    } else if (n.type === 'mention' && n.referenceId) {
      router.push(`/post/${n.referenceId}`)
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
                ? 'bg-accent text-white shadow-sm shadow-accent/30'
                : 'glass text-text-secondary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-16">
          <p className="text-4xl mb-4">🔔</p>
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
              <span className="text-xl shrink-0 mt-0.5">{TYPE_ICONS[n.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-text text-sm leading-snug">
                  {n.actorHash
                    ? <span className="font-semibold">Someone</span>
                    : <span className="font-semibold">A human</span>
                  }
                  {' '}{TYPE_LABELS[n.type]}
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
