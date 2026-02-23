import { cn } from '@/lib/utils'
import { BOARDS, type BoardId } from '@/lib/types'

interface Props {
  boardId: BoardId
  className?: string
}

export function BoardTag({ boardId, className }: Props) {
  const board = BOARDS.find((b) => b.id === boardId)
  if (!board) return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        'bg-surface-up text-text-secondary border border-border',
        'rounded-full px-2 py-0.5',
        className
      )}
    >
      <span>{board.emoji}</span>
      <span>#{board.label}</span>
    </span>
  )
}
