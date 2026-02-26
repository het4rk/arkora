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
      <p className="text-3xl mb-4">⚡</p>
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
          className="px-5 py-2.5 bg-accent text-white text-sm font-semibold rounded-[var(--r-lg)] active:scale-95 transition-all"
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
