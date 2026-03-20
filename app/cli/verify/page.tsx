'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  IDKitRequestWidget,
  orbLegacy,
  type IDKitResult,
  type IDKitErrorCodes,
  type RpContext,
} from '@worldcoin/idkit'

type PageState =
  | 'loading'
  | 'ready'
  | 'verifying'
  | 'authorizing'
  | 'success'
  | 'error'

function VerifyContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [state, setState] = useState<PageState>('loading')
  const [error, setError] = useState('')
  const [idkitOpen, setIdkitOpen] = useState(false)
  const [rpContext, setRpContext] = useState<RpContext | null>(null)

  const appId = (process.env.NEXT_PUBLIC_APP_ID ?? '') as `app_${string}`
  const actionId = process.env.NEXT_PUBLIC_ACTION_ID ?? ''

  // Validate token and fetch RP context on mount
  useEffect(() => {
    if (!token || !/^[0-9a-f]{64}$/.test(token)) {
      setError('Invalid or missing token.')
      setState('error')
      return
    }

    // Fetch RP context for IDKit, then auto-open the widget
    fetch('/api/idkit/context')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setRpContext(data.data)
          setState('ready')
          // Auto-open IDKit widget after a brief delay for render
          setTimeout(() => setIdkitOpen(true), 300)
        } else {
          setError(data.error ?? 'Failed to initialize verification')
          setState('error')
        }
      })
      .catch(() => {
        setError('Network error. Please try again.')
        setState('error')
      })
  }, [token])

  // After World ID verification succeeds, authorize the CLI session
  const handleVerify = useCallback(
    async (result: IDKitResult) => {
      setState('verifying')

      // Send proof to /api/verify - this sets the arkora-nh cookie
      const verifyRes = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idkitResult: result }),
      })
      const verifyData = await verifyRes.json()

      if (!verifyRes.ok || !verifyData.success) {
        // "Already verified" is fine - cookie gets restored
        if (!verifyData.nullifierHash) {
          setError(verifyData.error ?? 'Verification failed')
          setState('error')
          throw new Error(verifyData.error ?? 'Verification failed')
        }
      }

      // Now authorize the CLI session (cookie is set, same origin)
      setState('authorizing')
      const authRes = await fetch('/api/cli/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const authData = await authRes.json()

      if (!authRes.ok || !authData.success) {
        setError(authData.error ?? 'Failed to authorize CLI')
        setState('error')
        throw new Error(authData.error ?? 'Failed to authorize CLI')
      }
    },
    [token]
  )

  const onSuccess = useCallback(() => {
    setState('success')
  }, [])

  const onError = useCallback((errorCode: IDKitErrorCodes) => {
    const message =
      errorCode === 'user_rejected'
        ? 'Verification was declined. Please try again.'
        : errorCode === 'max_verifications_reached'
          ? 'You have already verified.'
          : `Verification failed: ${errorCode}`
    setError(message)
    setIdkitOpen(false)
    setState('error')
  }, [])

  return (
    <>
      {rpContext && (
        <IDKitRequestWidget
          app_id={appId}
          action={actionId}
          rp_context={rpContext}
          allow_legacy_proofs={true}
          preset={orbLegacy()}
          open={idkitOpen}
          onOpenChange={(open) => setIdkitOpen(open)}
          handleVerify={handleVerify}
          onSuccess={onSuccess}
          onError={onError}
        />
      )}

      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 w-full max-w-sm text-center space-y-6">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">Arkora</h1>
            <p className="text-sm text-white/50">CLI Authorization</p>
          </div>

          {state === 'loading' && (
            <p className="text-sm text-white/60">Initializing World ID...</p>
          )}

          {state === 'ready' && (
            <div className="space-y-4">
              <p className="text-sm text-white/70">
                Verify with World ID to authorize the CLI.
              </p>
              <button
                onClick={() => setIdkitOpen(true)}
                className="w-full rounded-xl bg-white text-black px-6 py-2.5 text-sm font-semibold hover:bg-white/90 transition-colors"
              >
                Verify with World ID
              </button>
            </div>
          )}

          {state === 'verifying' && (
            <p className="text-sm text-white/60">Verifying proof...</p>
          )}

          {state === 'authorizing' && (
            <p className="text-sm text-white/60">Creating API key...</p>
          )}

          {state === 'success' && (
            <div className="space-y-3">
              <div className="text-3xl text-green-400">&#10003;</div>
              <p className="text-sm text-white/70">
                CLI authorized. You can close this page.
              </p>
              <p className="text-xs text-white/40">
                Return to your terminal - it should be logged in.
              </p>
            </div>
          )}

          {state === 'error' && (
            <div className="space-y-4">
              <p className="text-sm text-red-400">{error}</p>
              {error.includes('already verified') ? (
                // Already verified means cookie was restored - can still authorize
                <button
                  onClick={async () => {
                    setState('authorizing')
                    try {
                      const res = await fetch('/api/cli/authorize', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token }),
                      })
                      const data = await res.json()
                      if (data.success) {
                        setState('success')
                      } else {
                        setError(data.error ?? 'Authorization failed')
                        setState('error')
                      }
                    } catch {
                      setError('Network error')
                      setState('error')
                    }
                  }}
                  className="w-full rounded-xl bg-white text-black px-6 py-2.5 text-sm font-semibold hover:bg-white/90 transition-colors"
                >
                  Authorize CLI
                </button>
              ) : (
                <button
                  onClick={() => {
                    setError('')
                    setState('ready')
                    setTimeout(() => setIdkitOpen(true), 200)
                  }}
                  className="rounded-xl bg-white/10 px-6 py-2.5 text-sm font-medium hover:bg-white/15 transition-colors"
                >
                  Try again
                </button>
              )}
            </div>
          )}

          <p className="text-xs text-white/30">
            Proof validated on World Chain
          </p>
        </div>
      </div>
    </>
  )
}

export default function CliVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-white/60">Loading...</p>
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  )
}
