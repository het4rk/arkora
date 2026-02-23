'use client'

import { useEffect, useRef } from 'react'
import { MiniKit, type MiniAppWalletAuthSuccessPayload } from '@worldcoin/minikit-js'
import { useArkoraStore } from '@/store/useArkoraStore'
import type { HumanUser } from '@/lib/types'

// Silently triggers walletAuth on app open, then auto-verifies the user
// using a wallet-derived identity — no separate World ID ZK step required.
export function WalletConnect() {
  const { walletAddress, setWalletAddress, setVerified } = useArkoraStore()
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
          // ── Step 1: walletAuth (SIWE sign-in) ──────────────────────
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

          if (!authJson.success || !authJson.walletAddress) return

          setWalletAddress(authJson.walletAddress)

          // ── Step 2: auto-verify via wallet-derived identity ─────────
          // Derives a stable pseudonymous nullifier from the wallet address
          // server-side — user is marked verified immediately, no separate
          // World ID ZK proof modal needed.
          const userRes = await fetch('/api/auth/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: authJson.walletAddress }),
          })

          const userJson = (await userRes.json()) as {
            success: boolean
            nullifierHash?: string
            user?: HumanUser
          }

          if (userJson.success && userJson.nullifierHash && userJson.user) {
            setVerified(userJson.nullifierHash, userJson.user)
          }
        } catch {
          // Silent failure — user can still browse anonymously
        }
      })()
    }

    tryAuth()
    return () => clearTimeout(timer)
  }, [walletAddress, setWalletAddress, setVerified])

  return null
}
