'use client'

import { useEffect } from 'react'
import { useArkoraStore } from '@/store/useArkoraStore'
import type { HumanUser } from '@/lib/types'

export function SessionHydrator() {
  const { isVerified, setVerified } = useArkoraStore()

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

  return null
}
