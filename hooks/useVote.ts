'use client'

import { useState, useCallback } from 'react'
import { useArkoraStore } from '@/store/useArkoraStore'

interface UseVoteReturn {
  castVote: (postId: string, direction: 1 | -1) => Promise<void>
  isVoting: boolean
  myVote: (postId: string) => 1 | -1 | null
}

export function useVote(): UseVoteReturn {
  const [isVoting, setIsVoting] = useState(false)
  const { nullifierHash, isVerified, optimisticVotes, setOptimisticVote, clearOptimisticVote } =
    useArkoraStore()

  const myVote = useCallback(
    (postId: string): 1 | -1 | null => optimisticVotes[postId] ?? null,
    [optimisticVotes]
  )

  const castVote = useCallback(
    async (postId: string, direction: 1 | -1) => {
      if (!isVerified || !nullifierHash) {
        useArkoraStore.getState().setVerifySheetOpen(true)
        return
      }

      // Capture previous state so we can restore it on failure
      const previousVote = optimisticVotes[postId] ?? null
      const isToggleOff = previousVote === direction

      // Optimistic update immediately
      if (isToggleOff) {
        clearOptimisticVote(postId)
      } else {
        setOptimisticVote(postId, direction)
      }
      setIsVoting(true)

      try {
        await fetch('/api/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId, direction: isToggleOff ? 0 : direction }),
        })
      } catch {
        // Restore exact previous state on failure
        if (previousVote !== null) {
          setOptimisticVote(postId, previousVote)
        } else {
          clearOptimisticVote(postId)
        }
      } finally {
        setIsVoting(false)
      }
    },
    [isVerified, nullifierHash, optimisticVotes, setOptimisticVote, clearOptimisticVote]
  )

  return { castVote, isVoting, myVote }
}
