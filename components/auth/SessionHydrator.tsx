'use client'

import { useEffect } from 'react'
import { useArkoraStore } from '@/store/useArkoraStore'
import type { HumanUser } from '@/lib/types'
import type { SkinId } from '@/lib/skins'

export function SessionHydrator() {
  const { isVerified, setVerified, setOwnedSkins, setActiveSkin } = useArkoraStore()

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

  return null
}
