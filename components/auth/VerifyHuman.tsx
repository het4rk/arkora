'use client'

import { useRef } from 'react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { HumanBadge } from '@/components/ui/HumanBadge'
import { useArkoraStore } from '@/store/useArkoraStore'
import { useVerification } from '@/hooks/useVerification'
import { IDKitWidget, VerificationLevel, type ISuccessResult } from '@worldcoin/idkit'

export function VerifyHuman() {
  const { isVerifySheetOpen, setVerifySheetOpen, isVerified } = useArkoraStore()
  const { status, error, isMiniKit, verify, handleDesktopVerify, onDesktopSuccess } = useVerification()
  // Holds the IDKit open() fn so we can call it after the sheet closes
  const idkitOpenRef = useRef<(() => void) | null>(null)

  if (isVerified) return null

  const appId = (process.env.NEXT_PUBLIC_APP_ID ?? '') as `app_${string}`
  const actionId = process.env.NEXT_PUBLIC_ACTION_ID ?? 'verifyhuman'

  return (
    <>
      {/* IDKitWidget lives OUTSIDE the sheet so closing the sheet doesn't unmount it.
          Its children render nothing — we call open() imperatively via ref. */}
      {!isMiniKit && (
        <IDKitWidget
          app_id={appId}
          action={actionId}
          verification_level={VerificationLevel.Orb}
          handleVerify={(proof: ISuccessResult) => handleDesktopVerify(proof)}
          onSuccess={onDesktopSuccess}
          onError={() => {
            // Reopen verify sheet so the user can see the error message
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
              {isMiniKit
                ? 'Arkora uses World ID Orb verification to guarantee every voice is from a real, unique human. No accounts. No tracking. Your identity stays private.'
                : 'Scan the QR code with your World App to verify your humanity. Your identity stays private.'}
            </p>
          </div>

          {error && (
            <p className="text-downvote text-sm bg-downvote/10 rounded-xl px-4 py-2 w-full">
              {error}
            </p>
          )}

          {isMiniKit ? (
            /* ─── World App: MiniKit flow ─────────────────────────── */
            <button
              onClick={() => void verify()}
              disabled={status === 'pending'}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-colors active:scale-95 text-base"
            >
              {status === 'pending' ? 'Verifying…' : 'Verify with World ID'}
            </button>
          ) : (
            /* ─── Desktop: close sheet first, then open IDKit QR ─── */
            <button
              onClick={() => {
                setVerifySheetOpen(false)
                // Let the sheet animate out before IDKit's modal opens
                setTimeout(() => idkitOpenRef.current?.(), 200)
              }}
              disabled={status === 'pending'}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-colors active:scale-95 text-base"
            >
              {status === 'pending' ? 'Verifying…' : 'Verify with World ID'}
            </button>
          )}

          <p className="text-text-muted text-xs">
            {isMiniKit
              ? 'Powered by World ID — Orb verification required'
              : 'Scan the QR code with World App on your phone'}
          </p>
        </div>
      </BottomSheet>
    </>
  )
}
