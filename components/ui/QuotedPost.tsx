'use client'

import { useRouter } from 'next/navigation'
import type { Post } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  post: Post
  interactive?: boolean | undefined
  className?: string | undefined
}

export function QuotedPost({ post, interactive = true, className }: Props) {
  const router = useRouter()
  const displayName = post.pseudoHandle ?? post.sessionTag

  return (
    <div
      className={cn(
        'glass rounded-[var(--r-md)] px-3 py-3 border border-accent/20',
        interactive && 'cursor-pointer active:scale-[0.99] transition-transform',
        className
      )}
      onClick={interactive ? (e) => { e.stopPropagation(); router.push(`/post/${post.id}`) } : undefined}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="text-accent shrink-0">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
        <span className="text-accent text-[10px] font-semibold truncate">{displayName} ✓</span>
      </div>
      <p className="text-text-secondary text-xs leading-relaxed line-clamp-2">
        {post.title}
      </p>
    </div>
  )
}
