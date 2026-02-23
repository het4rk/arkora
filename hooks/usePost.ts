'use client'

import { useState, useCallback } from 'react'
import { useArkoraStore } from '@/store/useArkoraStore'
import type { Post, BoardId, CreatePostInput } from '@/lib/types'

interface UsePostReturn {
  submit: (input: Omit<CreatePostInput, 'nullifierHash'>) => Promise<Post | null>
  isSubmitting: boolean
  error: string | null
}

export function usePost(): UsePostReturn {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { nullifierHash, isVerified } = useArkoraStore()

  const submit = useCallback(
    async (
      input: Omit<CreatePostInput, 'nullifierHash'>
    ): Promise<Post | null> => {
      if (!isVerified || !nullifierHash) {
        useArkoraStore.getState().setVerifySheetOpen(true)
        return null
      }

      setIsSubmitting(true)
      setError(null)

      try {
        const res = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...input, nullifierHash } satisfies CreatePostInput),
        })

        const json = (await res.json()) as { success: boolean; data?: Post; error?: string }

        if (!res.ok || !json.success) {
          throw new Error(json.error ?? 'Failed to create post')
        }

        return json.data ?? null
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        setError(msg)
        return null
      } finally {
        setIsSubmitting(false)
      }
    },
    [nullifierHash, isVerified]
  )

  return { submit, isSubmitting, error }
}
