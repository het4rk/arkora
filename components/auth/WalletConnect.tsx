'use client'

import { useEffect, useRef } from 'react'
import { MiniKit, type MiniAppWalletAuthSuccessPayload } from '@worldcoin/minikit-js'
import { useArkoraStore } from '@/store/useArkoraStore'
import type { HumanUser } from '@/lib/types'

// Silently triggers walletAuth on app open, then auto-verifies the user
// using a wallet-derived identity — no separate World ID ZK step required.
export function WalletConnect() {
  const { walletAddress, isVerified, setWalletAddress, setVerified } = useArkoraStore()
  const attempted = useRef(false)

  useEffect(() => {
    // Already fully signed in and verified — nothing to do
    if (isVerified || attempted.current) return

    attempted.current = true

    // ── Fast path: wallet address already persisted, just re-verify ──────
    // This happens when the user signed in before auto-verify was added,
    // or when the store is hydrated from localStorage with walletAddress
    // but isVerified=false (e.g. after a code update).
    if (walletAddress) {
      void callUserEndpoint(walletAddress)
      return
    }

    // ── Full path: no wallet yet — wait for MiniKit, then walletAuth ──────
    let retries = 0
    const MAX_RETRIES = 20 // up to ~6s (20 × 300ms)
    let pendingTimer: ReturnType<typeof setTimeout> | null = null

    // MiniKit.isInstalled() internally calls console.error() every time it
    // returns false — which floods the Next.js dev overlay during our 20-retry
    // polling loop. We silence ONLY that specific message during retries.
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

    function tryAuth() {
      if (!silentIsInstalled()) {
        if (retries++ < MAX_RETRIES) {
          pendingTimer = setTimeout(tryAuth, 300)
        }
        return
      }

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

          if (!authJson.success || !authJson.walletAddress) return

          // Capture World App username right after walletAuth while MiniKit.user is fresh
          const miniKitUsername = MiniKit.user?.username ?? undefined

          setWalletAddress(authJson.walletAddress)
          await callUserEndpoint(authJson.walletAddress, miniKitUsername)
        } catch {
          // Silent failure — user can still browse anonymously
        }
      })()

    }

    tryAuth()

    // Cleanup: cancel any pending MiniKit-wait timer if component unmounts
    return () => {
      if (pendingTimer !== null) clearTimeout(pendingTimer)
    }
  }, [walletAddress, isVerified, setWalletAddress, setVerified])

  async function callUserEndpoint(address: string, username?: string) {
    try {
      const userRes = await fetch('/api/auth/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, username }),
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
      // Silent failure
    }
  }

  return null
}
