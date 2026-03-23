import { ImageResponse } from '@vercel/og'
import { type NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const title = searchParams.get('title') ?? 'Arkora'
  const board = searchParams.get('board') ?? ''
  const votes = searchParams.get('votes') ?? ''
  const type = searchParams.get('type') ?? 'post'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px',
          backgroundColor: '#0a0a0a',
          color: '#ffffff',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Top: Board tag + type */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {board && (
            <div
              style={{
                fontSize: '20px',
                color: '#9e9ea8',
                backgroundColor: '#1a1a1a',
                padding: '6px 16px',
                borderRadius: '8px',
              }}
            >
              #{board}
            </div>
          )}
          {type === 'poll' && (
            <div
              style={{
                fontSize: '20px',
                color: '#6366F1',
                backgroundColor: '#1a1a1a',
                padding: '6px 16px',
                borderRadius: '8px',
              }}
            >
              Poll
            </div>
          )}
        </div>

        {/* Center: Title */}
        <div
          style={{
            fontSize: title.length > 80 ? '36px' : title.length > 40 ? '48px' : '56px',
            fontWeight: 700,
            lineHeight: 1.2,
            maxHeight: '240px',
            overflow: 'hidden',
          }}
        >
          {title.length > 120 ? title.slice(0, 117) + '...' : title}
        </div>

        {/* Bottom: Logo + votes */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                fontSize: '28px',
                fontWeight: 700,
                letterSpacing: '-0.5px',
              }}
            >
              ARKORA
            </div>
            <div style={{ fontSize: '18px', color: '#58585f' }}>
              provably human
            </div>
          </div>
          {votes && (
            <div style={{ fontSize: '20px', color: '#9e9ea8' }}>
              {votes} votes
            </div>
          )}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
