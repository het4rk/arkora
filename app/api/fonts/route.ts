import { NextResponse } from 'next/server'
import { getCallerNullifier } from '@/lib/serverAuth'
import { getOwnedFonts, getActiveFont } from '@/lib/db/fonts'

export async function GET() {
  const nullifierHash = await getCallerNullifier()
  if (!nullifierHash) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  }

  const [owned, active] = await Promise.all([
    getOwnedFonts(nullifierHash),
    getActiveFont(nullifierHash),
  ])

  return NextResponse.json({
    success: true,
    data: {
      owned,
      activeFontId: active.fontId,
    },
  })
}
