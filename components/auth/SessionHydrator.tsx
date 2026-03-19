'use client'

import { useEffect } from 'react'
import { authFetch } from '@/lib/authFetch'
import { useArkoraStore, type Theme } from '@/store/useArkoraStore'
import type { HumanUser } from '@/lib/types'
import type { SkinId } from '@/lib/skins'
import type { FontId } from '@/lib/fonts'

function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  return authFetch(url, { signal: AbortSignal.timeout(ms) })
}

export function SessionHydrator() {
  const {
    isVerified, nullifierHash, setVerified, signOut,
    setOwnedSkins, setActiveSkin,
    setOwnedFonts, setActiveFont,
    setTheme, setNotifyReplies, setNotifyDms, setNotifyFollows, setNotifyFollowedPosts,
    setLocationEnabled, setLocationRadius,
  } = useArkoraStore()

  // Always validate session on mount - catches stale localStorage auth when cookie expired
  useEffect(() => {
    void fetchWithTimeout('/api/me')
      .then((r) => r.json())
      .then((json: { success: boolean; nullifierHash: string | null; user: HumanUser | null }) => {
        if (json.nullifierHash && json.user) {
          setVerified(json.nullifierHash, json.user)
        } else if (isVerified) {
          // Cookie expired but store still thinks we're authed - clear stale state
          signOut()
        }
      })
      .catch(() => {/* silent */})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Hydrate skin preferences after auth (re-fetches when identity changes,
  // e.g. WalletConnect resolves wlt_ identity after World ID re-verify)
  useEffect(() => {
    if (!isVerified) return
    void fetchWithTimeout('/api/skins')
      .then((r) => r.json())
      .then((json: { success: boolean; data?: { owned: string[]; activeSkinId: string; customHex: string | null } }) => {
        if (json.success && json.data) {
          setOwnedSkins(json.data.owned as SkinId[])
          setActiveSkin(json.data.activeSkinId as SkinId, json.data.customHex)
        }
      })
      .catch(() => {/* silent */})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVerified, nullifierHash])

  // Hydrate font preferences after auth
  useEffect(() => {
    if (!isVerified) return
    void fetchWithTimeout('/api/fonts')
      .then((r) => r.json())
      .then((json: { success: boolean; data?: { owned: string[]; activeFontId: string } }) => {
        if (json.success && json.data) {
          setOwnedFonts(json.data.owned as FontId[])
          setActiveFont(json.data.activeFontId as FontId)
        }
      })
      .catch(() => {/* silent */})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVerified, nullifierHash])

  // Hydrate synced preferences (theme, notifications, location) after auth
  useEffect(() => {
    if (!isVerified) return
    void fetchWithTimeout('/api/preferences')
      .then((r) => r.json())
      .then((json: { success: boolean; data?: {
        theme: string | null; notifyReplies: boolean | null; notifyDms: boolean | null;
        notifyFollows: boolean | null; notifyFollowedPosts: boolean | null;
        locationEnabled: boolean | null; locationRadius: number | null;
      } }) => {
        if (json.success && json.data) {
          const d = json.data
          if (d.theme === 'dark' || d.theme === 'light') setTheme(d.theme as Theme)
          if (d.notifyReplies !== null) setNotifyReplies(d.notifyReplies)
          if (d.notifyDms !== null) setNotifyDms(d.notifyDms)
          if (d.notifyFollows !== null) setNotifyFollows(d.notifyFollows)
          if (d.notifyFollowedPosts !== null) setNotifyFollowedPosts(d.notifyFollowedPosts)
          if (d.locationEnabled !== null) setLocationEnabled(d.locationEnabled)
          if (d.locationRadius !== null) setLocationRadius(d.locationRadius)
        }
      })
      .catch(() => {/* silent */})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVerified, nullifierHash])

  return null
}
