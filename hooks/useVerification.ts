'use client'

import { useState, useCallback, useEffect } from 'react'
import { MiniKit, VerificationLevel, type ISuccessResult } from '@worldcoin/minikit-js'
import { useArkoraStore } from '@/store/useArkoraStore'
import type { HumanUser } from '@/lib/types'

type VerificationStatus = 'idle' | 'pending' | 'success' | 'error'

/** Maps server error codes to user-facing messages */
function friendlyVerifyError(serverError: string | undefined): string {
  switch (serverError) {
    case 'max_verifications_reached':
      return 'You have already verified. Your session will be restored.'
    case 'expired_root':
      return 'Verification expired. Please close and try again.'
    case 'network_error':
      return 'Could not reach the blockchain. Please try again in a moment.'
    case 'invalid_proof':
      return 'Verification failed. Please try again.'
    case 'Too many requests':
      return 'Too many attempts. Please wait a minute and try again.'
    default:
      return serverError ?? 'Verification failed. Please try again.'
  }
}

/**
 * Three-way environment:
 *  'detecting'      - polling for MiniKit, UI should show neutral loading state
 *  'minikit'        - running inside World App WebView (MiniKit available)
 *  'mobile-browser' - mobile device (phone/tablet/iPad) but NOT inside World App
 *  'desktop'        - desktop / laptop browser
 */
export type VerifyEnvironment = 'detecting' | 'minikit' | 'mobile-browser' | 'desktop'

function isMobileDevice(): boolean {
  // maxTouchPoints covers modern iPads even when they report a desktop UA.
  // Regex covers older devices and Android.
  return (
    navigator.maxTouchPoints > 0 ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  )
}

interface UseVerificationReturn {
  status: VerificationStatus
  error: string | null
  setError: (err: string | null) => void
  env: VerifyEnvironment
  /** @deprecated use env === 'minikit' */
  isMiniKit: boolean
  verify: () => Promise<boolean>
  handleDesktopVerify: (proof: ISuccessResult) => Promise<void>
  onDesktopSuccess: () => void
  isVerified: boolean
}

export function useVerification(): UseVerificationReturn {
  const [status, setStatus] = useState<VerificationStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [env, setEnv] = useState<VerifyEnvironment>('detecting')

  const { isVerified, nullifierHash, walletAddress, setVerified } = useArkoraStore()

  // Detect environment after mount.
  // MiniKit requires the World App WebView to inject window.WorldApp, which can
  // take 300–600 ms. We poll up to ~3 s (15 × 200 ms) before concluding
  // MiniKit is unavailable - same strategy as WalletConnect.tsx.
  useEffect(() => {
    let retries = 0
    const MAX_RETRIES = 15
    let timer: ReturnType<typeof setTimeout> | null = null

    function silentIsInstalled(): boolean {
      const orig = console.error
      console.error = (...args: unknown[]) => {
        if (typeof args[0] === 'string' && args[0].includes('MiniKit is not installed')) return
        ;(orig as (...a: unknown[]) => void)(...args)
      }
      const result = MiniKit.isInstalled()
      console.error = orig
      return result
    }

    function poll() {
      if (silentIsInstalled()) {
        setEnv('minikit')
        return
      }
      if (retries++ < MAX_RETRIES) {
        timer = setTimeout(poll, 200)
      } else {
        setEnv(isMobileDevice() ? 'mobile-browser' : 'desktop')
      }
    }

    poll()
    return () => { if (timer !== null) clearTimeout(timer) }
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

  // ─── IDKit flow (mobile browser + desktop) ────────────────────────────
  const handleDesktopVerify = useCallback(
    async (proof: ISuccessResult): Promise<void> => {
      console.log('[handleVerify] Called with proof, merkle_root length:', proof.merkle_root?.length, 'proof length:', proof.proof?.length)
      setStatus('pending')
      setError(null)

      let res: Response
      try {
        res = await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payload: proof,
            action: process.env.NEXT_PUBLIC_ACTION_ID ?? 'verifyhuman',
          }),
          signal: AbortSignal.timeout(15000),
        })
      } catch {
        const msg = 'Network error. Please check your connection and try again.'
        console.error('[handleVerify] Fetch failed:', msg)
        setStatus('error')
        setError(msg)
        throw new Error(msg)
      }

      const json = (await res.json()) as {
        success: boolean
        nullifierHash?: string
        user?: HumanUser
        error?: string
      }

      console.log('[handleVerify] Server response:', res.status, json.success, json.error ?? 'OK')

      if (!res.ok || !json.success) {
        const friendly = friendlyVerifyError(json.error)
        console.error('[handleVerify] Verification failed:', json.error, '->', friendly)
        setStatus('error')
        setError(friendly)
        throw new Error(friendly)
      }

      console.log('[handleVerify] Success! nullifier:', json.nullifierHash?.slice(0, 16) + '...')
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

  return {
    status,
    error,
    setError,
    env,
    isMiniKit: env === 'minikit',
    verify,
    handleDesktopVerify,
    onDesktopSuccess,
    isVerified,
  }
}
