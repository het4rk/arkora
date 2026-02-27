'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { HumanUser, BoardId, Post } from '@/lib/types'
import type { SkinId } from '@/lib/skins'

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
  // Alias - auto-generated from nullifier, user can rename it (persisted locally)
  persistentAlias: string | null

  // Appearance
  theme: Theme
  activeSkinId: SkinId
  customHex: string | null
  ownedSkins: SkinId[]

  // Onboarding
  hasOnboarded: boolean

  // UI State
  activeBoard: BoardId | null
  isComposerOpen: boolean
  composerQuotedPost: Post | null
  isVerifySheetOpen: boolean
  isDrawerOpen: boolean
  isSearchOpen: boolean

  // Location - locationEnabled tags posts with GPS; locationRadius controls local feed view radius
  locationEnabled: boolean
  locationRadius: number   // miles; -1 = entire country

  // DM - private key stored client-side only, never sent to server
  dmPrivateKey: string | null

  // Notification preferences
  notifyReplies: boolean
  notifyDms: boolean
  notifyFollows: boolean
  notifyFollowedPosts: boolean

  // Active room (non-persisted - clears on reload)
  activeRoomId: string | null
  activeRoomTitle: string | null

  // Optimistic vote cache: postId → direction
  optimisticVotes: Record<string, 1 | -1>

  // Notification badge (non-persisted)
  unreadNotificationCount: number

  // Set when user explicitly clicks "Sign out" - prevents auto-re-auth on page reload
  hasExplicitlySignedOut: boolean

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
  setLocationEnabled: (v: boolean) => void
  setLocationRadius: (miles: number) => void
  setOptimisticVote: (postId: string, direction: 1 | -1) => void
  clearOptimisticVote: (postId: string) => void
  setNotifyReplies: (v: boolean) => void
  setNotifyDms: (v: boolean) => void
  setNotifyFollows: (v: boolean) => void
  setNotifyFollowedPosts: (v: boolean) => void
  setUnreadNotificationCount: (count: number) => void
  setActiveRoomId: (id: string | null) => void
  setActiveRoomTitle: (title: string | null) => void
  setHasExplicitlySignedOut: (v: boolean) => void
  setActiveSkin: (skinId: SkinId, customHex?: string | null) => void
  setOwnedSkins: (skins: SkinId[]) => void
  setUser: (user: HumanUser) => void
  reset: () => void
  signOut: () => void
}

const initialState = {
  walletAddress: null,
  nullifierHash: null,
  isVerified: false,
  user: null,
  identityMode: 'anonymous' as IdentityMode,
  persistentAlias: null,
  theme: 'dark' as Theme,
  activeSkinId: 'monochrome' as SkinId,
  customHex: null as string | null,
  ownedSkins: [] as SkinId[],
  hasOnboarded: false,
  activeBoard: null,
  activeRoomId: null,
  activeRoomTitle: null,
  isComposerOpen: false,
  composerQuotedPost: null,
  locationEnabled: false,
  locationRadius: 50,
  dmPrivateKey: null,
  notifyReplies: true,
  notifyDms: true,
  notifyFollows: true,
  notifyFollowedPosts: true,
  isVerifySheetOpen: false,
  isDrawerOpen: false,
  isSearchOpen: false,
  optimisticVotes: {},
  unreadNotificationCount: 0,
  hasExplicitlySignedOut: false,
}

export const useArkoraStore = create<ArkoraState>()(
  persist(
    (set) => ({
      ...initialState,

      setWalletAddress: (address) => set({ walletAddress: address }),

      setVerified: (nullifierHash, user) =>
        set({ nullifierHash, user, isVerified: true, hasExplicitlySignedOut: false }),

      setIdentityMode: (mode) => set({ identityMode: mode }),

      setPersistentAlias: (alias) => set({ persistentAlias: alias }),

      setTheme: (theme) => set({ theme }),

      setHasOnboarded: (v) => set({ hasOnboarded: v }),

      setActiveBoard: (boardId) => set({ activeBoard: boardId }),

      setComposerOpen: (open) => set({ isComposerOpen: open }),

      setComposerQuotedPost: (post) => set({ composerQuotedPost: post }),

      setDmPrivateKey: (key) => set({ dmPrivateKey: key }),

      setVerifySheetOpen: (open) => set({ isVerifySheetOpen: open }),

      setLocationEnabled: (v) => set({ locationEnabled: v }),

      setLocationRadius: (miles) => set({ locationRadius: miles }),

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

      setNotifyReplies: (v) => set({ notifyReplies: v }),

      setNotifyDms: (v) => set({ notifyDms: v }),

      setNotifyFollows: (v) => set({ notifyFollows: v }),

      setNotifyFollowedPosts: (v) => set({ notifyFollowedPosts: v }),

      setUnreadNotificationCount: (count) => set({ unreadNotificationCount: count }),

      setActiveRoomId: (id) => set({ activeRoomId: id }),

      setActiveRoomTitle: (title) => set({ activeRoomTitle: title }),

      setHasExplicitlySignedOut: (v) => set({ hasExplicitlySignedOut: v }),

      setActiveSkin: (skinId, customHex) =>
        set({ activeSkinId: skinId, customHex: customHex ?? null }),

      setOwnedSkins: (skins) => set({ ownedSkins: skins }),

      setUser: (user) => set({ user }),

      reset: () => set(initialState),

      // Clears auth state only - preserves theme, identity prefs, location settings, and onboarding flag
      signOut: () =>
        set({
          walletAddress: null,
          nullifierHash: null,
          isVerified: false,
          user: null,
          dmPrivateKey: null,
          optimisticVotes: {},
          unreadNotificationCount: 0,
          isComposerOpen: false,
          composerQuotedPost: null,
          isVerifySheetOpen: false,
          isDrawerOpen: false,
          isSearchOpen: false,
          activeSkinId: 'monochrome' as SkinId,
          customHex: null,
          ownedSkins: [],
          hasExplicitlySignedOut: true,
        }),
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
        activeSkinId: state.activeSkinId,
        customHex: state.customHex,
        ownedSkins: state.ownedSkins,
        hasOnboarded: state.hasOnboarded,
        locationEnabled: state.locationEnabled,
        locationRadius: state.locationRadius,
        dmPrivateKey: state.dmPrivateKey,
        notifyReplies: state.notifyReplies,
        notifyDms: state.notifyDms,
        notifyFollows: state.notifyFollows,
        notifyFollowedPosts: state.notifyFollowedPosts,
        optimisticVotes: state.optimisticVotes,
        hasExplicitlySignedOut: state.hasExplicitlySignedOut,
      }),
    }
  )
)
