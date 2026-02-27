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
        'inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em]',
        'text-text-muted',
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-text-muted inline-block" />
      {board.label}
    </span>
  )
}
