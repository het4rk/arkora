'use client'

import type { RoomMessage } from '@/lib/types'

interface RoomMessageProps {
  message: RoomMessage
  isOwn: boolean
}

export function RoomMessageRow({ message, isOwn }: RoomMessageProps) {
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
      <div className="flex items-baseline gap-2">
        {!isOwn && (
          <span className="text-[11px] font-semibold text-accent">{message.displayHandle}</span>
        )}
        <span className="text-[10px] text-text-muted">{time}</span>
      </div>
      <div className={`max-w-[80%] px-3.5 py-2.5 rounded-[var(--r-lg)] text-sm leading-relaxed ${
        isOwn
          ? 'bg-accent text-background rounded-br-[4px]'
          : 'glass text-text rounded-bl-[4px]'
      }`}>
        {message.text}
      </div>
    </div>
  )
}
