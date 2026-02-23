'use client'

import type { Reply } from '@/lib/types'
import { ReplyCard } from './ReplyCard'

interface Props {
  replies: Reply[]
  /** The reply being replied to — highlight its subtree */
  onReplyTo: (reply: Reply) => void
  onDeleted?: (() => void) | undefined
  depth?: number | undefined
}

/** Build parent → [children] map from a flat reply list */
function buildTree(replies: Reply[]): Map<string | null, Reply[]> {
  const map = new Map<string | null, Reply[]>()
  for (const r of replies) {
    const parent = r.parentReplyId ?? null
    if (!map.has(parent)) map.set(parent, [])
    map.get(parent)!.push(r)
  }
  return map
}

export function ReplyTree({ replies, onReplyTo, onDeleted, depth = 0 }: Props) {
  const tree = buildTree(replies)
  const roots = tree.get(null) ?? []

  return (
    <div className="space-y-3">
      {roots.map((reply, i) => (
        <ReplyBranch
          key={reply.id}
          reply={reply}
          tree={tree}
          onReplyTo={onReplyTo}
          onDeleted={onDeleted}
          depth={depth}
          isTopReply={depth === 0 && i === 0}
        />
      ))}
    </div>
  )
}

interface BranchProps {
  reply: Reply
  tree: Map<string | null, Reply[]>
  onReplyTo: (reply: Reply) => void
  onDeleted?: (() => void) | undefined
  depth: number
  isTopReply: boolean
}

function ReplyBranch({ reply, tree, onReplyTo, onDeleted, depth, isTopReply }: BranchProps) {
  const children = tree.get(reply.id) ?? []
  const MAX_DEPTH = 4

  return (
    <div>
      <ReplyCard
        reply={reply}
        isTopReply={isTopReply}
        onReplyTo={onReplyTo}
        onDeleted={onDeleted}
      />

      {children.length > 0 && depth < MAX_DEPTH && (
        <div
          className="mt-2 ml-3 pl-3 border-l border-white/[0.08]"
          style={{ marginLeft: Math.min(depth + 1, 4) * 12 }}
        >
          <div className="space-y-2">
            {children.map((child) => (
              <ReplyBranch
                key={child.id}
                reply={child}
                tree={tree}
                onReplyTo={onReplyTo}
                onDeleted={onDeleted}
                depth={depth + 1}
                isTopReply={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
