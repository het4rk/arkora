'use client'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Props) {
  return (
    <html lang="en">
      <body style={{ background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: '24px', textAlign: 'center' }}>
        <p style={{ fontSize: 32, marginBottom: 16 }}>⚡</p>
        <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Something went wrong</p>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 4, maxWidth: 320, wordBreak: 'break-all' }}>{error.message}</p>
        {error.digest && <p style={{ color: '#555', fontSize: 11, marginBottom: 24 }}>digest: {error.digest}</p>}
        <button
          onClick={reset}
          style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
