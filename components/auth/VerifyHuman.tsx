'use client'

import { useRef, useCallback } from 'react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { HumanBadge } from '@/components/ui/HumanBadge'
import { useArkoraStore } from '@/store/useArkoraStore'
import { useVerification } from '@/hooks/useVerification'
import { IDKitWidget, VerificationLevel, useIDKit, type ISuccessResult, type IErrorState } from '@worldcoin/idkit'

export function VerifyHuman() {
  const { isVerifySheetOpen, setVerifySheetOpen, isVerified } = useArkoraStore()
  const { status, error, setError, env, verify, handleDesktopVerify, onDesktopSuccess } = useVerification()
  const idkitOpenRef = useRef<(() => void) | null>(null)
  // Tracks whether handleDesktopVerify set an error (avoids stale closure in onError)
  const verifySetErrorRef = useRef(false)
  // IDKit's setOpen lets us auto-close the IDKit modal on verify failure,
  // which triggers onError → shows our custom error sheet instead of IDKit's generic screen.
  const { setOpen: idkitSetOpen } = useIDKit()

  const wrappedHandleVerify = useCallback(async (proof: ISuccessResult) => {
    verifySetErrorRef.current = false
    try {
      await handleDesktopVerify(proof)
    } catch (err) {
      verifySetErrorRef.current = true
      // Auto-dismiss IDKit's generic error screen so our custom error sheet shows instead.
      // IDKit's onOpenChange(false) fires onError callbacks, which re-open our sheet.
      setTimeout(() => idkitSetOpen(false), 50)
      throw err
    }
  }, [handleDesktopVerify, idkitSetOpen])

  if (isVerified) return null

  const appId = (process.env.NEXT_PUBLIC_APP_ID ?? '') as `app_${string}`
  const actionId = process.env.NEXT_PUBLIC_ACTION_ID ?? 'verifyhuman'

  // IDKit handles both mobile-browser (deeplink to World App) and desktop (QR code).
  const needsIdKit = env === 'mobile-browser' || env === 'desktop'

  function openIdKit() {
    setVerifySheetOpen(false)
    setTimeout(() => idkitOpenRef.current?.(), 200)
  }

  const subtitles = {
    detecting: 'Detecting your environment…',
    minikit: 'Your proof is validated directly on World Chain - not on our servers. One verification, permanently on-chain.',
    'mobile-browser': "You're browsing outside of World App. Tap below to verify with a QR code - open your World App camera to scan it. For one-tap verification, open Arkora directly in World App.",
    desktop: 'Scan the QR code with World App on your phone. Your proof is validated on World Chain - not on a central server.',
  }

  const footers = {
    detecting: 'Powered by World ID',
    minikit: 'Proof validated on World Chain · Powered by World ID',
    'mobile-browser': 'For best results, open Arkora directly in World App',
    desktop: 'Proof validated on World Chain · Scan with World App',
  }

  const buttonLabel =
    status === 'pending' ? 'Verifying…'
    : env === 'detecting' ? 'Loading…'
    : env === 'minikit' ? 'Verify with World ID'
    : 'Verify with QR Code'

  const envBadge =
    env === 'minikit' ? { color: 'bg-text-muted', label: 'World App detected' }
    : env === 'mobile-browser' ? { color: 'bg-text-muted', label: 'Mobile browser' }
    : env === 'desktop' ? { color: 'bg-text-muted', label: 'Desktop browser' }
    : null

  return (
    <>
      {/* IDKitWidget lives outside the sheet so closing doesn't unmount it */}
      {needsIdKit && (
        <IDKitWidget
          app_id={appId}
          action={actionId}
          verification_level={VerificationLevel.Orb}
          handleVerify={wrappedHandleVerify}
          onSuccess={onDesktopSuccess}
          onError={(idkitError: IErrorState) => {
            if (!verifySetErrorRef.current) {
              setError(idkitError?.message ?? 'Verification was declined. Please try again.')
            }
            verifySetErrorRef.current = false
            setTimeout(() => setVerifySheetOpen(true), 100)
          }}
        >
          {({ open }: { open: () => void }) => {
            idkitOpenRef.current = open
            return <></>
          }}
        </IDKitWidget>
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
              onClick={env === 'detecting' ? undefined : openIdKit}
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
