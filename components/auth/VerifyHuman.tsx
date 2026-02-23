'use client'

import { BottomSheet } from '@/components/ui/BottomSheet'
import { HumanBadge } from '@/components/ui/HumanBadge'
import { useArkoraStore } from '@/store/useArkoraStore'
import { useVerification } from '@/hooks/useVerification'

export function VerifyHuman() {
  const { isVerifySheetOpen, setVerifySheetOpen, isVerified } = useArkoraStore()
  const { status, error, verify } = useVerification()

  if (isVerified) return null

  return (
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
            Arkora uses World ID Orb verification to guarantee every voice is
            from a real, unique human. No accounts. No tracking. Your identity
            stays private.
          </p>
        </div>

        {error && (
          <p className="text-downvote text-sm bg-downvote/10 rounded-xl px-4 py-2 w-full">
            {error}
          </p>
        )}

        <button
          onClick={() => void verify()}
          disabled={status === 'pending'}
          className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-colors active:scale-95 text-base"
        >
          {status === 'pending' ? 'Verifying…' : 'Verify with World ID'}
        </button>

        <p className="text-text-muted text-xs">
          Powered by World ID — Orb verification required
        </p>
      </div>
    </BottomSheet>
  )
}
