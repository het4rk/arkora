'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { HumanUser, BoardId, Post } from '@/lib/types'

export type IdentityMode = 'anonymous' | 'alias' | 'named'
export type Theme = 'dark' | 'light'

interface ArkoraState {
  // Auth & Identity
  walletAddress: string | null
  nullifierHash: string | null
  isVerified: boolean
  user: HumanUser | null

  // Identity preference
  identityMode: IdentityMode
  // Alias — auto-generated from nullifier, user can rename it (persisted locally)
  persistentAlias: string | null

  // Appearance
  theme: Theme

  // Onboarding
  hasOnboarded: boolean

  // UI State
  activeBoard: BoardId | null
  isComposerOpen: boolean
  composerQuotedPost: Post | null
  isVerifySheetOpen: boolean
  isDrawerOpen: boolean
  isSearchOpen: boolean

  // DM — private key stored client-side only, never sent to server
  dmPrivateKey: string | null

  // Optimistic vote cache: postId → direction
  optimisticVotes: Record<string, 1 | -1>

  // Actions
  setWalletAddress: (address: string | null) => void
  setVerified: (nullifierHash: string, user: HumanUser) => void
  setIdentityMode: (mode: IdentityMode) => void
  setPersistentAlias: (alias: string | null) => void
  setTheme: (theme: Theme) => void
  setHasOnboarded: (v: boolean) => void
  setActiveBoard: (boardId: BoardId | null) => void
  setComposerOpen: (open: boolean) => void
  setComposerQuotedPost: (post: Post | null) => void
  setDmPrivateKey: (key: string | null) => void
  setVerifySheetOpen: (open: boolean) => void
  setDrawerOpen: (open: boolean) => void
  setSearchOpen: (open: boolean) => void
  setOptimisticVote: (postId: string, direction: 1 | -1) => void
  clearOptimisticVote: (postId: string) => void
  reset: () => void
}

const initialState = {
  walletAddress: null,
  nullifierHash: null,
  isVerified: false,
  user: null,
  identityMode: 'anonymous' as IdentityMode,
  persistentAlias: null,
  theme: 'dark' as Theme,
  hasOnboarded: false,
  activeBoard: null,
  isComposerOpen: false,
  composerQuotedPost: null,
  dmPrivateKey: null,
  isVerifySheetOpen: false,
  isDrawerOpen: false,
  isSearchOpen: false,
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

      setTheme: (theme) => set({ theme }),

      setHasOnboarded: (v) => set({ hasOnboarded: v }),

      setActiveBoard: (boardId) => set({ activeBoard: boardId }),

      setComposerOpen: (open) => set({ isComposerOpen: open }),

      setComposerQuotedPost: (post) => set({ composerQuotedPost: post }),

      setDmPrivateKey: (key) => set({ dmPrivateKey: key }),

      setVerifySheetOpen: (open) => set({ isVerifySheetOpen: open }),

      setDrawerOpen: (open) => set({ isDrawerOpen: open }),

      setSearchOpen: (open) => set({ isSearchOpen: open }),

      setOptimisticVote: (postId, direction) =>
        set((state) => ({
          optimisticVotes: { ...state.optimisticVotes, [postId]: direction },
        })),

      clearOptimisticVote: (postId) =>
        set((state) => {
          const next = { ...state.optimisticVotes }
          delete next[postId]
          return { optimisticVotes: next }
        }),

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
        theme: state.theme,
        hasOnboarded: state.hasOnboarded,
        dmPrivateKey: state.dmPrivateKey,
      }),
    }
  )
)
