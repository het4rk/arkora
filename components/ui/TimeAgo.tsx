'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import { cn } from '@/lib/utils'

interface Props {
  date: Date | string
  className?: string
}

export function TimeAgo({ date, className }: Props) {
  const d = typeof date === 'string' ? new Date(date) : date
  const [localLabel, setLocalLabel] = useState<string>('')

  useEffect(() => {
    // Computed client-side so it uses the viewer's local timezone
    const ageMs = Date.now() - d.getTime()
    const timePart = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (ageMs < 86_400_000) {
      // < 24 h - show just the clock time ("3:45 PM")
      setLocalLabel(timePart)
    } else {
      // Older - show "Jan 23, 3:45 PM" or "Jan 23 2024, 3:45 PM" across year boundary
      const sameYear = d.getFullYear() === new Date().getFullYear()
      const datePart = d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        ...(sameYear ? {} : { year: 'numeric' }),
      })
      setLocalLabel(`${datePart}, ${timePart}`)
    }
  }, [d])

  const relative = formatDistanceToNowStrict(d, { addSuffix: true })

  return (
    <time
      dateTime={d.toISOString()}
      className={cn('text-text-muted text-xs text-right leading-snug', className)}
    >
      <span className="block">{relative}</span>
      {localLabel && (
        <span className="block text-[10px] opacity-55">{localLabel}</span>
      )}
    </time>
  )
}
