import { NextRequest, NextResponse } from 'next/server'
import { getCallerNullifier } from '@/lib/serverAuth'
import { getOwnedFonts, setActiveFont } from '@/lib/db/fonts'
import { isValidFontId } from '@/lib/fonts'

export async function PATCH(req: NextRequest) {
  const nullifierHash = await getCallerNullifier()
  if (!nullifierHash) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
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
    const owned = await getOwnedFonts(nullifierHash)
    if (!owned.includes(fontId)) {
      return NextResponse.json({ success: false, error: 'Font not owned' }, { status: 403 })
    }
  }

  await setActiveFont(nullifierHash, fontId)

  return NextResponse.json({ success: true })
}
