'use client'

import { useEffect, useRef } from 'react'
import { MiniKit, type MiniAppWalletAuthSuccessPayload } from '@worldcoin/minikit-js'
import { useArkoraStore } from '@/store/useArkoraStore'

// Silently triggers walletAuth on app open.
// No UI — this is a background component mounted in layout.tsx.
export function WalletConnect() {
  const { walletAddress, setWalletAddress } = useArkoraStore()
  const attempted = useRef(false)

  useEffect(() => {
    if (walletAddress || attempted.current) return

    let retries = 0
    const MAX_RETRIES = 20 // up to ~6s total (20 × 300ms)
    let timer: ReturnType<typeof setTimeout>

    function tryAuth() {
      // MiniKit is injected asynchronously by the World App WebView —
      // retry until it's ready rather than bailing on first check.
      if (!MiniKit.isInstalled()) {
        if (retries++ < MAX_RETRIES) {
          timer = setTimeout(tryAuth, 300)
        }
        return
      }

      attempted.current = true

      void (async () => {
        try {
          const res = await fetch('/api/nonce')
          const { nonce } = (await res.json()) as { nonce: string }

          const { finalPayload } = await MiniKit.commandsAsync.walletAuth({
            nonce,
            requestId: '0',
            expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            notBefore: new Date(Date.now() - 24 * 60 * 60 * 1000),
            statement: 'Sign in to Arkora — provably human anonymous message board.',
          })

          if (finalPayload.status === 'error') return

          const authRes = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              payload: finalPayload as MiniAppWalletAuthSuccessPayload,
              nonce,
            }),
          })

          const authJson = (await authRes.json()) as {
            success: boolean
            walletAddress?: string
          }

          if (authJson.success && authJson.walletAddress) {
            setWalletAddress(authJson.walletAddress)
          }
        } catch {
          // Silent failure — user can still browse
        }
      })()
    }

    tryAuth()
    return () => clearTimeout(timer)
  }, [walletAddress, setWalletAddress])

  return null
}
