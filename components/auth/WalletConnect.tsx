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

    function tryAuth() {
      if (!MiniKit.isInstalled()) {
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

          setWalletAddress(authJson.walletAddress)
          await callUserEndpoint(authJson.walletAddress)
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

  async function callUserEndpoint(address: string) {
    try {
      const userRes = await fetch('/api/auth/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
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
