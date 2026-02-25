'use client'

import { useRef } from 'react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { HumanBadge } from '@/components/ui/HumanBadge'
import { useArkoraStore } from '@/store/useArkoraStore'
import { useVerification } from '@/hooks/useVerification'
import { IDKitWidget, VerificationLevel, type ISuccessResult } from '@worldcoin/idkit'

export function VerifyHuman() {
  const { isVerifySheetOpen, setVerifySheetOpen, isVerified } = useArkoraStore()
  const { status, error, env, verify, handleDesktopVerify, onDesktopSuccess } = useVerification()
  const idkitOpenRef = useRef<(() => void) | null>(null)

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
    minikit: 'Arkora uses World ID Orb verification to guarantee every voice is from a real, unique human. No accounts. No tracking. Your identity stays private.',
    'mobile-browser': "You're in a browser, not the World App. Tap below — World App will open automatically to verify you.",
    desktop: 'Scan the QR code with World App on your phone to verify your humanity. Your identity stays private.',
  }

  const footers = {
    detecting: 'Powered by World ID',
    minikit: 'Powered by World ID — Orb verification required',
    'mobile-browser': 'World App will open on your phone or tablet',
    desktop: 'Scan the QR code with World App on your phone',
  }

  const buttonLabel =
    status === 'pending' ? 'Verifying…'
    : env === 'detecting' ? 'Loading…'
    : env === 'minikit' ? 'Verify with World ID'
    : env === 'mobile-browser' ? 'Open World App to Verify'
    : 'Scan QR with World App'

  const envBadge =
    env === 'minikit' ? { color: 'bg-green-400', label: 'World App detected' }
    : env === 'mobile-browser' ? { color: 'bg-yellow-400', label: 'Browser detected — not in World App' }
    : env === 'desktop' ? { color: 'bg-blue-400', label: 'Desktop browser' }
    : null

  return (
    <>
      {/* IDKitWidget lives outside the sheet so closing doesn't unmount it */}
      {needsIdKit && (
        <IDKitWidget
          app_id={appId}
          action={actionId}
          verification_level={VerificationLevel.Orb}
          handleVerify={(proof: ISuccessResult) => handleDesktopVerify(proof)}
          onSuccess={onDesktopSuccess}
          onError={() => {
            setTimeout(() => setVerifySheetOpen(true), 100)
          }}
        >
          {({ open }: { open: () => void }) => {
            idkitOpenRef.current = open
            return null
          }}
        </IDKitWidget>
      )}

      <BottomSheet
        isOpen={isVerifySheetOpen}
        onClose={() => setVerifySheetOpen(false)}
        title="Verify you're human"
      >
        <div className="flex flex-col items-center text-center gap-6 py-4">
          <HumanBadge size="lg" label="Human ✓" />

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
            <p className="text-downvote text-sm bg-downvote/10 rounded-xl px-4 py-2 w-full">
              {error}
            </p>
          )}

          {env === 'minikit' ? (
            <button
              onClick={() => void verify()}
              disabled={status === 'pending'}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-colors active:scale-95 text-base"
            >
              {buttonLabel}
            </button>
          ) : (
            <button
              onClick={env === 'detecting' ? undefined : openIdKit}
              disabled={status === 'pending' || env === 'detecting'}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-colors active:scale-95 text-base"
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
