import Image from 'next/image'
import { cn } from '@/lib/utils'

interface Props {
  avatarUrl?: string | null
  label?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string | undefined
}

const sizes = {
  sm: 'w-5 h-5 text-[8px]',
  md: 'w-8 h-8 text-[11px]',
  lg: 'w-12 h-12 text-[15px]',
}

export function Avatar({ avatarUrl, label, size = 'md', className }: Props) {
  const initials = label
    ? label.slice(0, 2).toUpperCase()
    : '?'

  return (
    <span
      className={cn(
        'rounded-full overflow-hidden inline-flex items-center justify-center shrink-0',
        'bg-accent/20 border border-accent/30 text-accent font-bold',
        sizes[size],
        className
      )}
    >
      {avatarUrl ? (
        <span className="relative w-full h-full">
          <Image src={avatarUrl} alt={label ?? 'Avatar'} fill className="object-cover" />
        </span>
      ) : (
        <span>{initials}</span>
      )}
    </span>
  )
}
