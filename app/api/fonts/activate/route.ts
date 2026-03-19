import { NextRequest, NextResponse } from 'next/server'
import { getCallerNullifier, getLinkedNullifiers } from '@/lib/serverAuth'
import { getOwnedFontsByNullifiers, setActiveFont } from '@/lib/db/fonts'
import { isValidFontId } from '@/lib/fonts'
import { rateLimit } from '@/lib/rateLimit'

export async function PATCH(req: NextRequest) {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    if (!rateLimit(`font-activate:${nullifierHash}`, 30, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    const body = (await req.json()) as { fontId?: string }
    const { fontId } = body

    if (!fontId) {
      return NextResponse.json({ success: false, error: 'Missing fontId' }, { status: 400 })
    }

    if (!isValidFontId(fontId)) {
      return NextResponse.json({ success: false, error: 'Invalid font' }, { status: 400 })
    }

    // System font is always available
    if (fontId !== 'system') {
      const nullifiers = await getLinkedNullifiers(nullifierHash)
      const owned = await getOwnedFontsByNullifiers(nullifiers)
      if (!owned.includes(fontId)) {
        return NextResponse.json({ success: false, error: 'Font not owned' }, { status: 403 })
      }
    }

    await setActiveFont(nullifierHash, fontId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[fonts/activate PATCH]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to activate font' }, { status: 500 })
  }
}
