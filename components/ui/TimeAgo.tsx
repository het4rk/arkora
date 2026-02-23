'use client'

import { formatDistanceToNowStrict } from 'date-fns'
import { cn } from '@/lib/utils'

interface Props {
  date: Date | string
  className?: string
}

export function TimeAgo({ date, className }: Props) {
  const d = typeof date === 'string' ? new Date(date) : date
  const label = formatDistanceToNowStrict(d, { addSuffix: true })

  return (
    <time
      dateTime={d.toISOString()}
      className={cn('text-text-muted text-xs', className)}
      title={d.toLocaleString()}
    >
      {label}
    </time>
  )
}
