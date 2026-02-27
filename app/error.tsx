'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: Props) {
  useEffect(() => {
    console.error('[AppError]', error)
  }, [error])

  const router = useRouter()

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 text-center">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted mb-4"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
      <p className="text-text font-bold text-lg mb-2">Something went wrong</p>
      <p className="text-text-muted text-sm mb-1 max-w-xs leading-relaxed">
        An unexpected error occurred. You can try again or go back to the feed.
      </p>
      {error.digest && (
        <p className="text-text-muted/40 text-[10px] mb-6 font-mono">ref: {error.digest}</p>
      )}
      {!error.digest && <div className="mb-6" />}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-accent text-background text-sm font-semibold rounded-[var(--r-lg)] active:scale-95 transition-all"
        >
          Try again
        </button>
        <button
          onClick={() => router.push('/')}
          className="px-5 py-2.5 glass text-text-secondary text-sm font-semibold rounded-[var(--r-lg)] active:opacity-70 transition-opacity"
        >
          Back to feed
        </button>
      </div>
    </div>
  )
}
