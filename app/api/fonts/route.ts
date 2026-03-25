import { NextResponse } from 'next/server'
import { getCallerNullifier, getLinkedNullifiers } from '@/lib/serverAuth'
import { getOwnedFontsByNullifiers, getActiveFontForNullifiers } from '@/lib/db/fonts'
import { rateLimit } from '@/lib/rateLimit'

export async function GET() {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    if (!(await rateLimit(`fonts-get:${nullifierHash}`, 60, 60_000))) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    const nullifiers = await getLinkedNullifiers(nullifierHash)

    const [owned, active] = await Promise.all([
      getOwnedFontsByNullifiers(nullifiers),
      getActiveFontForNullifiers(nullifiers),
    ])

    return NextResponse.json({
      success: true,
      data: {
        owned,
        activeFontId: active.fontId,
      },
    })
  } catch (err) {
    console.error('[fonts]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to load fonts' }, { status: 500 })
  }
}
