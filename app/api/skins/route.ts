import { NextResponse } from 'next/server'
import { getCallerNullifier } from '@/lib/serverAuth'
import { getOwnedSkins, getActiveSkin } from '@/lib/db/skins'

export async function GET() {
  const nullifierHash = await getCallerNullifier()
  if (!nullifierHash) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  }

  const [owned, active] = await Promise.all([
    getOwnedSkins(nullifierHash),
    getActiveSkin(nullifierHash),
  ])

  return NextResponse.json({
    success: true,
    data: {
      owned,
      activeSkinId: active.skinId,
      customHex: active.customHex,
    },
  })
}
