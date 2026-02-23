'use client'

import { useState, useCallback } from 'react'
import { MiniKit, VerificationLevel, type ISuccessResult } from '@worldcoin/minikit-js'
import { useArkoraStore } from '@/store/useArkoraStore'

type VerificationStatus = 'idle' | 'pending' | 'success' | 'error'

interface UseVerificationReturn {
  status: VerificationStatus
  error: string | null
  verify: () => Promise<boolean>
  isVerified: boolean
}

export function useVerification(): UseVerificationReturn {
  const [status, setStatus] = useState<VerificationStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const { isVerified, nullifierHash, walletAddress, setVerified } = useArkoraStore()

  const verify = useCallback(async (): Promise<boolean> => {
    if (isVerified && nullifierHash) return true

    if (!MiniKit.isInstalled()) {
      setError('World App not detected. Please open in World App.')
      setStatus('error')
      return false
    }

    setStatus('pending')
    setError(null)

    try {
      const { finalPayload } = await MiniKit.commandsAsync.verify({
        action: process.env.NEXT_PUBLIC_ACTION_ID ?? 'verify-human',
        verification_level: VerificationLevel.Orb,
      })

      if (finalPayload.status === 'error') {
        setError('Verification cancelled or failed.')
        setStatus('error')
        return false
      }

      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: finalPayload as ISuccessResult,
          action: process.env.NEXT_PUBLIC_ACTION_ID ?? 'verify-human',
          walletAddress: walletAddress ?? '',
        }),
      })

      const json = (await res.json()) as {
        success: boolean
        nullifierHash?: string
        user?: ReturnType<typeof useArkoraStore.getState>['user']
        error?: string
      }

      if (!res.ok || !json.success) {
        setError(json.error ?? 'Verification failed on server.')
        setStatus('error')
        return false
      }

      if (json.nullifierHash && json.user) {
        setVerified(json.nullifierHash, json.user)
      }

      setStatus('success')
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
      setStatus('error')
      return false
    }
  }, [isVerified, nullifierHash, walletAddress, setVerified])

  return { status, error, verify, isVerified }
}
