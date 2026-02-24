'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'

type BadgeSize = 'sm' | 'md' | 'lg'

interface Props {
  label?: string
  avatarUrl?: string | null
  nullifierHash?: string | null
  size?: BadgeSize
  className?: string | undefined
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-xs gap-0.5 px-1.5 py-0.5',
  md: 'text-sm gap-1 px-2 py-1',
  lg: 'text-base gap-1.5 px-3 py-1.5',
}

const checkSizes: Record<BadgeSize, string> = {
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
}

const avatarSizes: Record<BadgeSize, 'sm' | 'sm' | 'md'> = {
  sm: 'sm',
  md: 'sm',
  lg: 'md',
}

export function HumanBadge({ label, avatarUrl, nullifierHash, size = 'md', className }: Props) {
  const router = useRouter()
  const tappable = !!nullifierHash

  const inner = (
    <span
      className={cn(
        'inline-flex self-start w-fit items-center rounded-full font-medium',
        'bg-accent/15 text-accent border border-accent/30',
        sizeStyles[size],
        tappable && 'cursor-pointer active:opacity-70 transition-opacity',
        className
      )}
      onClick={tappable ? (e) => { e.stopPropagation(); router.push(`/u/${nullifierHash}`) } : undefined}
    >
      {avatarUrl !== undefined && (
        <Avatar avatarUrl={avatarUrl} label={label ?? null} size={avatarSizes[size]} className="-ml-0.5 mr-1" />
      )}
      {label && <span>{label}</span>}
      <span
        className={cn('font-bold leading-none', checkSizes[size])}
        aria-label="Verified human"
      >
        ✓
      </span>
    </span>
  )

  return inner
}
