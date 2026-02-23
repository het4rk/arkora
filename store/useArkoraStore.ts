'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { HumanUser, BoardId } from '@/lib/types'

export type IdentityMode = 'anonymous' | 'alias' | 'named'

interface ArkoraState {
  // Auth & Identity
  walletAddress: string | null
  nullifierHash: string | null
  isVerified: boolean
  user: HumanUser | null

  // Identity preference
  identityMode: IdentityMode
  // Cached alias — generated once from nullifier, reused across all alias posts
  persistentAlias: string | null

  // UI State
  activeBoard: BoardId | null
  isComposerOpen: boolean
  isVerifySheetOpen: boolean

  // Optimistic vote cache: postId → direction
  optimisticVotes: Record<string, 1 | -1>

  // Actions
  setWalletAddress: (address: string | null) => void
  setVerified: (nullifierHash: string, user: HumanUser) => void
  setIdentityMode: (mode: IdentityMode) => void
  setPersistentAlias: (alias: string) => void
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
  identityMode: 'anonymous' as IdentityMode,
  persistentAlias: null,
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

      setIdentityMode: (mode) => set({ identityMode: mode }),

      setPersistentAlias: (alias) => set({ persistentAlias: alias }),

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
      partialize: (state) => ({
        walletAddress: state.walletAddress,
        nullifierHash: state.nullifierHash,
        isVerified: state.isVerified,
        user: state.user,
        identityMode: state.identityMode,
        persistentAlias: state.persistentAlias,
      }),
    }
  )
)
