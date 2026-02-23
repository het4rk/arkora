'use client'

import { useState, useCallback } from 'react'
import { MiniKit } from '@worldcoin/minikit-js'
import { useArkoraStore } from '@/store/useArkoraStore'
import { ARK_VOTES_ABI, getArkVotesAddress, isContractDeployed } from '@/lib/contracts'
import { stringToBytes32 } from '@/lib/utils'

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

      // Optimistic update immediately
      setOptimisticVote(postId, direction)
      setIsVoting(true)

      try {
        // 1. Record in off-chain DB first (instant UX)
        await fetch('/api/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId, direction, nullifierHash }),
        })

        // 2. Send onchain if contract is deployed
        if (isContractDeployed() && MiniKit.isInstalled()) {
          const postIdBytes32 = stringToBytes32(postId)
          const nullifierBytes32 = stringToBytes32(nullifierHash)

          await MiniKit.commandsAsync.sendTransaction({
            transaction: [
              {
                address: getArkVotesAddress(),
                abi: ARK_VOTES_ABI,
                functionName: 'castVote',
                args: [postIdBytes32, direction, nullifierBytes32],
              },
            ],
          })
          // We fire-and-forget the chain tx — optimistic UI already updated
        }
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
