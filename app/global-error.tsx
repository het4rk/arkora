'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import './globals.css'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])
  return (
    <html lang="en">
      <body className="bg-[#0a0a0a] text-white font-[system-ui,sans-serif] flex flex-col items-center justify-center min-h-dvh p-6 text-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-4"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
        <p className="font-bold text-lg mb-2">Something went wrong</p>
        <p className="text-[#888] text-[13px] mb-1 max-w-xs">An unexpected error occurred. Please try again.</p>
        {error.digest && <p className="text-[#555] text-[11px] mb-6">digest: {error.digest}</p>}
        <button
          onClick={reset}
          className="bg-white text-[#0a0a0a] border-0 rounded-xl px-6 py-3 font-semibold text-sm cursor-pointer"
        >
          Try again
        </button>
      </body>
    </html>
  )
}
