'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { BoardTag } from '@/components/ui/BoardTag'
import { useArkoraStore } from '@/store/useArkoraStore'
import { usePost } from '@/hooks/usePost'
import { BOARDS, type BoardId } from '@/lib/types'

export function PostComposer() {
  const router = useRouter()
  const { isComposerOpen, setComposerOpen } = useArkoraStore()
  const { submit, isSubmitting, error } = usePost()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [boardId, setBoardId] = useState<BoardId>('agora')

  async function handleSubmit() {
    if (!title.trim() || !body.trim()) return
    const post = await submit({ title, body, boardId })
    if (post) {
      setTitle('')
      setBody('')
      setComposerOpen(false)
      router.push(`/post/${post.id}`)
    }
  }

  return (
    <BottomSheet
      isOpen={isComposerOpen}
      onClose={() => setComposerOpen(false)}
      title="New post"
    >
      <div className="space-y-4">
        {/* Board selector */}
        <div>
          <label className="text-text-muted text-xs font-medium block mb-2">
            Board
          </label>
          <div className="flex flex-wrap gap-2">
            {BOARDS.map((board) => (
              <button
                key={board.id}
                onClick={() => setBoardId(board.id)}
                className="transition-all active:scale-95"
              >
                <BoardTag
                  boardId={board.id}
                  className={
                    boardId === board.id
                      ? 'bg-accent/20 border-accent text-accent'
                      : ''
                  }
                />
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="text-text-muted text-xs font-medium block mb-2">
            Title <span className="text-text-muted">({title.length}/280)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 280))}
            placeholder="What's on your mind?"
            className="w-full bg-surface-up border border-border rounded-xl px-4 py-3 text-text placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors text-base"
          />
        </div>

        {/* Body */}
        <div>
          <label className="text-text-muted text-xs font-medium block mb-2">
            Body
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 10000))}
            placeholder="Share your thoughts…"
            rows={5}
            className="w-full bg-surface-up border border-border rounded-xl px-4 py-3 text-text placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none text-base"
          />
        </div>

        {error && (
          <p className="text-downvote text-sm bg-downvote/10 rounded-xl px-4 py-2">
            {error}
          </p>
        )}

        <button
          onClick={() => void handleSubmit()}
          disabled={isSubmitting || !title.trim() || !body.trim()}
          className="w-full bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-bold py-4 rounded-2xl transition-colors active:scale-95 text-base"
        >
          {isSubmitting ? 'Posting…' : 'Post anonymously'}
        </button>

        <p className="text-text-muted text-xs text-center">
          Posted as a verified human. No identity revealed.
        </p>
      </div>
    </BottomSheet>
  )
}
