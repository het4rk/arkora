'use client'

import { useState, useCallback } from 'react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { HumanBadge } from '@/components/ui/HumanBadge'
import { useArkoraStore } from '@/store/useArkoraStore'
import { useVerification } from '@/hooks/useVerification'
import { IDKitRequestWidget, orbLegacy, type IDKitResult, type IDKitErrorCodes, type RpContext } from '@worldcoin/idkit'

export function VerifyHuman() {
  const { isVerifySheetOpen, setVerifySheetOpen, isVerified } = useArkoraStore()
  const { status, error, setError, env, verify, handleDesktopVerify, onDesktopSuccess } = useVerification()
  const [idkitOpen, setIdkitOpen] = useState(false)
  const [rpContext, setRpContext] = useState<RpContext | null>(null)

  const fetchRpContext = useCallback(async (): Promise<RpContext | null> => {
    try {
      const res = await fetch('/api/idkit/context')
      const json = (await res.json()) as { success: boolean; data?: RpContext; error?: string }
      if (!res.ok || !json.success || !json.data) {
        setError(json.error ?? 'Failed to initialize verification')
        return null
      }
      return json.data
    } catch {
      setError('Network error. Please try again.')
      return null
    }
  }, [setError])

  const wrappedHandleVerify = useCallback(async (result: IDKitResult) => {
    await handleDesktopVerify(result)
  }, [handleDesktopVerify])

  if (isVerified) return null

  const appId = (process.env.NEXT_PUBLIC_APP_ID ?? '') as `app_${string}`
  const actionId = process.env.NEXT_PUBLIC_ACTION_ID ?? ''

  // IDKit handles both mobile-browser (deeplink to World App) and desktop (QR code).
  const needsIdKit = env === 'mobile-browser' || env === 'desktop'

  async function openIdKit() {
    setVerifySheetOpen(false)
    const ctx = await fetchRpContext()
    if (ctx) {
      setRpContext(ctx)
      setTimeout(() => setIdkitOpen(true), 200)
    } else {
      setVerifySheetOpen(true)
    }
  }

  const subtitles = {
    detecting: 'Detecting your environment...',
    minikit: 'Your proof is validated directly on World Chain - not on our servers. One verification, permanently on-chain.',
    'mobile-browser': "You're browsing outside of World App. Tap below to open a QR code, then scan it using your World App camera. For the best experience, open Arkora directly in World App.",
    desktop: 'Scan the QR code with World App on your phone. Your proof is validated on World Chain - not on a central server.',
  }

  const footers = {
    detecting: 'Powered by World ID',
    minikit: 'Proof validated on World Chain - Powered by World ID',
    'mobile-browser': 'For best results, open Arkora directly in World App',
    desktop: 'Proof validated on World Chain - Scan with World App',
  }

  const buttonLabel =
    status === 'pending' ? 'Verifying...'
    : env === 'detecting' ? 'Loading...'
    : env === 'minikit' ? 'Verify with World ID'
    : 'Verify with QR Code'

  const envBadge =
    env === 'minikit' ? { color: 'bg-text-muted', label: 'World App detected' }
    : env === 'mobile-browser' ? { color: 'bg-text-muted', label: 'Mobile browser' }
    : env === 'desktop' ? { color: 'bg-text-muted', label: 'Desktop browser' }
    : null

  return (
    <>
      {/* IDKitRequestWidget lives outside the sheet so closing doesn't unmount it */}
      {needsIdKit && rpContext && (
        <IDKitRequestWidget
          app_id={appId}
          action={actionId}
          rp_context={rpContext}
          allow_legacy_proofs={true}
          preset={orbLegacy()}
          open={idkitOpen}
          onOpenChange={(open) => {
            setIdkitOpen(open)
            if (!open) {
              setTimeout(() => setVerifySheetOpen(true), 100)
            }
          }}
          handleVerify={wrappedHandleVerify}
          onSuccess={onDesktopSuccess}
          onError={(errorCode: IDKitErrorCodes) => {
            const message = errorCode === 'user_rejected'
              ? 'Verification was declined. Please try again.'
              : errorCode === 'max_verifications_reached'
              ? 'You have already verified.'
              : `Verification failed: ${errorCode}`
            setError(message)
            setIdkitOpen(false)
            setTimeout(() => setVerifySheetOpen(true), 100)
          }}
        />
      )}

      <BottomSheet
        isOpen={isVerifySheetOpen}
        onClose={() => setVerifySheetOpen(false)}
        title="Verify you're human"
      >
        <div className="flex flex-col items-center text-center gap-6 py-4">
          <HumanBadge size="lg" label="Verified" />

          <div>
            <h3 className="text-text font-bold text-xl mb-2">
              One scan. Forever verified.
            </h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              {subtitles[env]}
            </p>
          </div>

          {/* Environment indicator */}
          {envBadge && (
            <div className="flex items-center gap-2 glass rounded-full px-3 py-1.5 text-xs text-text-muted">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${envBadge.color}`} />
              {envBadge.label}
            </div>
          )}

          {error && (
            <p className="text-text-secondary text-sm bg-surface-up rounded-xl px-4 py-2 w-full">
              {error}
            </p>
          )}

          {env === 'minikit' ? (
            <button
              onClick={() => void verify()}
              disabled={status === 'pending'}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-background font-bold py-4 rounded-2xl transition-colors active:scale-95 text-base"
            >
              {buttonLabel}
            </button>
          ) : (
            <button
              onClick={env === 'detecting' ? undefined : () => void openIdKit()}
              disabled={status === 'pending' || env === 'detecting'}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-background font-bold py-4 rounded-2xl transition-colors active:scale-95 text-base"
            >
              {buttonLabel}
            </button>
          )}

          <p className="text-text-muted text-xs">{footers[env]}</p>
        </div>
      </BottomSheet>
    </>
  )
}
