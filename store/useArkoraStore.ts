'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { HumanUser, BoardId } from '@/lib/types'

interface ArkoraState {
  // Auth & Identity
  walletAddress: string | null
  nullifierHash: string | null
  isVerified: boolean
  user: HumanUser | null

  // UI State
  activeBoard: BoardId | null
  isComposerOpen: boolean
  isVerifySheetOpen: boolean

  // Optimistic vote cache: postId → direction
  optimisticVotes: Record<string, 1 | -1>

  // Actions
  setWalletAddress: (address: string | null) => void
  setVerified: (nullifierHash: string, user: HumanUser) => void
  setActiveBoard: (boardId: BoardId | null) => void
  setComposerOpen: (open: boolean) => void
  setVerifySheetOpen: (open: boolean) => void
  setOptimisticVote: (postId: string, direction: 1 | -1) => void
  reset: () => void
}

const initialState = {
  walletAddress: null,
  nullifierHash: null,
  isVerified: false,
  user: null,
  activeBoard: null,
  isComposerOpen: false,
  isVerifySheetOpen: false,
  optimisticVotes: {},
}

export const useArkoraStore = create<ArkoraState>()(
  persist(
    (set) => ({
      ...initialState,

      setWalletAddress: (address) => set({ walletAddress: address }),

      setVerified: (nullifierHash, user) =>
        set({ nullifierHash, user, isVerified: true }),

      setActiveBoard: (boardId) => set({ activeBoard: boardId }),

      setComposerOpen: (open) => set({ isComposerOpen: open }),

      setVerifySheetOpen: (open) => set({ isVerifySheetOpen: open }),

      setOptimisticVote: (postId, direction) =>
        set((state) => ({
          optimisticVotes: { ...state.optimisticVotes, [postId]: direction },
        })),

      reset: () => set(initialState),
    }),
    {
      name: 'arkora-store',
      // Only persist identity — don't persist UI state
      partialize: (state) => ({
        walletAddress: state.walletAddress,
        nullifierHash: state.nullifierHash,
        isVerified: state.isVerified,
        user: state.user,
      }),
    }
  )
)
