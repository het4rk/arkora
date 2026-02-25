'use client'

import { useState, useCallback, useEffect } from 'react'
import { MiniKit, VerificationLevel, type ISuccessResult } from '@worldcoin/minikit-js'
import { useArkoraStore } from '@/store/useArkoraStore'
import type { HumanUser } from '@/lib/types'

type VerificationStatus = 'idle' | 'pending' | 'success' | 'error'

interface UseVerificationReturn {
  status: VerificationStatus
  error: string | null
  /** True when running inside World App (uses MiniKit). False = desktop (uses IDKit). */
  isMiniKit: boolean
  /** MiniKit flow — call this directly from a button click. */
  verify: () => Promise<boolean>
  /** IDKit flow — pass as `handleVerify` prop to IDKitWidget. Throws on failure. */
  handleDesktopVerify: (proof: ISuccessResult) => Promise<void>
  /** IDKit flow — pass as `onSuccess` prop to IDKitWidget. */
  onDesktopSuccess: () => void
  isVerified: boolean
}

export function useVerification(): UseVerificationReturn {
  const [status, setStatus] = useState<VerificationStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isMiniKit, setIsMiniKit] = useState(true) // default true; update after mount

  const { isVerified, nullifierHash, walletAddress, setVerified } = useArkoraStore()

  // Detect environment after mount (MiniKit requires DOM)
  useEffect(() => {
    setIsMiniKit(MiniKit.isInstalled())
  }, [])

  // ─── MiniKit flow (World App) ──────────────────────────────────────────
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
        action: process.env.NEXT_PUBLIC_ACTION_ID ?? 'verifyhuman',
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
          action: process.env.NEXT_PUBLIC_ACTION_ID ?? 'verifyhuman',
          walletAddress: walletAddress ?? '',
        }),
      })

      const json = (await res.json()) as {
        success: boolean
        nullifierHash?: string
        user?: HumanUser
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

  // ─── IDKit flow (desktop) ─────────────────────────────────────────────
  // Called by IDKitWidget's handleVerify prop. Must throw on failure to
  // show the error screen in the widget.
  const handleDesktopVerify = useCallback(
    async (proof: ISuccessResult): Promise<void> => {
      setStatus('pending')
      setError(null)

      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: proof,
          action: process.env.NEXT_PUBLIC_ACTION_ID ?? 'verifyhuman',
          // No walletAddress for desktop — server handles it
        }),
      })

      const json = (await res.json()) as {
        success: boolean
        nullifierHash?: string
        user?: HumanUser
        error?: string
      }

      if (!res.ok || !json.success) {
        setStatus('error')
        setError(json.error ?? 'Verification failed on server.')
        throw new Error(json.error ?? 'Verification failed')
      }

      if (json.nullifierHash && json.user) {
        setVerified(json.nullifierHash, json.user)
      }

      setStatus('success')
    },
    [setVerified]
  )

  const onDesktopSuccess = useCallback(() => {
    setStatus('success')
  }, [])

  return { status, error, isMiniKit, verify, handleDesktopVerify, onDesktopSuccess, isVerified }
}
