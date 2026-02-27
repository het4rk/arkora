'use client'

import { getKarmaTier } from '@/lib/karma'
import { cn } from '@/lib/utils'

interface Props {
  score: number
  className?: string
  showScore?: boolean
}

export function KarmaBadge({ score, className, showScore = false }: Props) {
  const tierConfig = getKarmaTier(score)

  // Don't render badge for newcomers - no badge is cleaner than a gray "Newcomer" label
  if (tierConfig.tier === 'newcomer') return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-1.5 py-0.5 leading-none',
        tierConfig.bg,
        tierConfig.color,
        className
      )}
    >
      <span>{tierConfig.label}</span>
      {showScore && <span className="opacity-70">· {score}</span>}
    </span>
  )
}
