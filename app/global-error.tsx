'use client'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Props) {
  return (
    <html lang="en">
      <body style={{ background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: '24px', textAlign: 'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
        <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Something went wrong</p>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 4, maxWidth: 320 }}>An unexpected error occurred. Please try again.</p>
        {error.digest && <p style={{ color: '#555', fontSize: 11, marginBottom: 24 }}>digest: {error.digest}</p>}
        <button
          onClick={reset}
          style={{ background: '#ffffff', color: '#0a0a0a', border: 'none', borderRadius: 12, padding: '12px 24px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
