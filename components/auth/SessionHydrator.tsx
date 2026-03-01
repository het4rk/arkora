'use client'

import { useEffect } from 'react'
import { useArkoraStore, type Theme } from '@/store/useArkoraStore'
import type { HumanUser } from '@/lib/types'
import type { SkinId } from '@/lib/skins'
import type { FontId } from '@/lib/fonts'

export function SessionHydrator() {
  const {
    isVerified, setVerified,
    setOwnedSkins, setActiveSkin,
    setOwnedFonts, setActiveFont,
    setTheme, setNotifyReplies, setNotifyDms, setNotifyFollows, setNotifyFollowedPosts,
    setLocationEnabled, setLocationRadius,
  } = useArkoraStore()

  useEffect(() => {
    if (isVerified) return
    void fetch('/api/me')
      .then((r) => r.json())
      .then((json: { success: boolean; nullifierHash: string | null; user: HumanUser | null }) => {
        if (json.nullifierHash && json.user) {
          setVerified(json.nullifierHash, json.user)
        }
      })
      .catch(() => {/* silent */})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Hydrate skin preferences after auth
  useEffect(() => {
    if (!isVerified) return
    void fetch('/api/skins')
      .then((r) => r.json())
      .then((json: { success: boolean; data?: { owned: string[]; activeSkinId: string; customHex: string | null } }) => {
        if (json.success && json.data) {
          setOwnedSkins(json.data.owned as SkinId[])
          setActiveSkin(json.data.activeSkinId as SkinId, json.data.customHex)
        }
      })
      .catch(() => {/* silent */})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVerified])

  // Hydrate font preferences after auth
  useEffect(() => {
    if (!isVerified) return
    void fetch('/api/fonts')
      .then((r) => r.json())
      .then((json: { success: boolean; data?: { owned: string[]; activeFontId: string } }) => {
        if (json.success && json.data) {
          setOwnedFonts(json.data.owned as FontId[])
          setActiveFont(json.data.activeFontId as FontId)
        }
      })
      .catch(() => {/* silent */})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVerified])

  // Hydrate synced preferences (theme, notifications, location) after auth
  useEffect(() => {
    if (!isVerified) return
    void fetch('/api/preferences')
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
  }, [isVerified])

  return null
}
