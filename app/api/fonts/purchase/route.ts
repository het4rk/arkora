import { NextRequest, NextResponse } from 'next/server'
import { getCallerNullifier } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'
import { recordFontPurchase, getOwnedFonts, setActiveFont } from '@/lib/db/fonts'
import { isValidFontId, getFontById } from '@/lib/fonts'

export async function POST(req: NextRequest) {
  const nullifierHash = await getCallerNullifier()
  if (!nullifierHash) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  }

  if (!rateLimit(`font-purchase:${nullifierHash}`, 5, 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }

  const body = (await req.json()) as { fontId?: string; txId?: string }
  const { fontId, txId } = body

  if (!fontId || !txId) {
    return NextResponse.json(
      { success: false, error: 'Missing fontId or txId' },
      { status: 400 }
    )
  }

  if (!isValidFontId(fontId)) {
    return NextResponse.json({ success: false, error: 'Invalid font' }, { status: 400 })
  }

  if (fontId === 'system') {
    return NextResponse.json({ success: false, error: 'System font is free' }, { status: 400 })
  }

  const font = getFontById(fontId)
  if (!font) {
    return NextResponse.json({ success: false, error: 'Font not found' }, { status: 400 })
  }

  const owned = await getOwnedFonts(nullifierHash)
  if (owned.includes(fontId)) {
    return NextResponse.json({ success: false, error: 'Already owned' }, { status: 400 })
  }

  await recordFontPurchase(nullifierHash, fontId, String(font.priceWld), txId)
  await setActiveFont(nullifierHash, fontId)

  return NextResponse.json({ success: true })
}
