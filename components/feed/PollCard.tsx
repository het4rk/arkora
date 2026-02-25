'use client'

import { useState } from 'react'
import type { Post, PollResult } from '@/lib/types'
import { haptic } from '@/lib/utils'

interface Props {
  post: Post
  initialResults: PollResult[]
  initialUserVote: number | null
}

function formatTimeLeft(endsAt: Date): string {
  const ms = new Date(endsAt).getTime() - Date.now()
  if (ms <= 0) return 'Ended'
  const hours = Math.floor(ms / 3_600_000)
  if (hours < 24) return `${hours}h left`
  const days = Math.floor(hours / 24)
  return `${days}d left`
}

export function PollCard({ post, initialResults, initialUserVote }: Props) {
  const [results, setResults] = useState<PollResult[]>(initialResults)
  const [userVote, setUserVote] = useState<number | null>(initialUserVote)
  const [isVoting, setIsVoting] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)

  const options = post.pollOptions ?? []
  const isExpired = post.pollEndsAt ? new Date(post.pollEndsAt) < new Date() : false
  const hasVoted = userVote !== null
  const showResults = hasVoted || isExpired

  const totalVotes = results.reduce((sum, r) => sum + r.count, 0)

  function getCount(optionIndex: number): number {
    return results.find((r) => r.optionIndex === optionIndex)?.count ?? 0
  }

  function getPct(optionIndex: number): number {
    if (totalVotes === 0) return 0
    return Math.round((getCount(optionIndex) / totalVotes) * 100)
  }

  async function vote(e: React.MouseEvent, optionIndex: number) {
    e.stopPropagation()
    if (isVoting || hasVoted || isExpired) return
    haptic('medium')
    setIsVoting(true)
    setVoteError(null)
    try {
      const res = await fetch(`/api/polls/${post.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionIndex }),
      })
      const json = (await res.json()) as { success: boolean; data?: { results: PollResult[]; userVote: number }; error?: string }
      if (json.success && json.data) {
        setResults(json.data.results)
        setUserVote(json.data.userVote)
      } else if (!json.success) {
        setVoteError(json.error ?? 'Failed to cast vote')
      }
    } catch {
      setVoteError('Failed to cast vote')
    } finally {
      setIsVoting(false)
    }
  }

  return (
    <div className="mt-4 space-y-2" onClick={(e) => e.stopPropagation()}>
      {options.map((opt) => {
        const pct = getPct(opt.index)
        const isChosen = userVote === opt.index

        if (!showResults) {
          // Clickable option buttons
          return (
            <button
              key={opt.index}
              onClick={(e) => void vote(e, opt.index)}
              disabled={isVoting}
              className="w-full text-left px-4 py-3 rounded-[var(--r-lg)] glass border border-border/30 text-sm font-medium text-text active:scale-[0.99] transition-all disabled:opacity-60"
            >
              {opt.text}
            </button>
          )
        }

        // Results bars
        return (
          <div key={opt.index} className="relative rounded-[var(--r-lg)] overflow-hidden">
            {/* Fill bar */}
            <div
              className={`absolute inset-y-0 left-0 transition-all duration-500 rounded-[var(--r-lg)] ${
                isChosen ? 'bg-accent/25' : 'bg-surface-up/60'
              }`}
              style={{ width: `${pct}%` }}
            />
            <div className="relative flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                {isChosen && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className="text-accent flex-shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                <span className={`text-sm font-medium ${isChosen ? 'text-text' : 'text-text-secondary'}`}>
                  {opt.text}
                </span>
              </div>
              <span className={`text-sm font-semibold tabular-nums ${isChosen ? 'text-accent' : 'text-text-muted'}`}>
                {pct}%
              </span>
            </div>
          </div>
        )
      })}

      {/* Vote error */}
      {voteError && (
        <p className="text-downvote text-[11px] pt-1">{voteError}</p>
      )}

      {/* Footer */}
      <p className="text-text-muted text-[11px] font-medium pt-1">
        {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        {post.pollEndsAt && (
          <>
            {' · '}
            {formatTimeLeft(new Date(post.pollEndsAt))}
          </>
        )}
      </p>
    </div>
  )
}
