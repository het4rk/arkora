import { cn } from '@/lib/utils'

type BadgeSize = 'sm' | 'md' | 'lg'

interface Props {
  label?: string // e.g. "Human #4821" — if omitted, shows just the checkmark
  size?: BadgeSize
  className?: string
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

export function HumanBadge({ label, size = 'md', className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex self-start w-fit items-center rounded-full font-medium',
        'bg-accent/15 text-accent border border-accent/30',
        sizeStyles[size],
        className
      )}
    >
      {label && <span>{label}</span>}
      <span
        className={cn('font-bold leading-none', checkSizes[size])}
        aria-label="Verified human"
      >
        ✓
      </span>
    </span>
  )
}
