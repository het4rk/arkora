import { NextRequest, NextResponse } from 'next/server'
import { requireApiKey, CORS_HEADERS } from '@/lib/apiKeyAuth'
import { rateLimit } from '@/lib/rateLimit'
import { getNullifierByKeyHash } from '@/lib/db/apiKeys'
import { getUserByNullifier } from '@/lib/db/users'
import { db } from '@/lib/db'
import { humanUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req)
  if (auth instanceof NextResponse) return auth

  if (!rateLimit(`v1me:${auth.key}`, 30, 60_000)) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: CORS_HEADERS }
    )
  }

  try {
    const nullifierHash = await getNullifierByKeyHash(auth.key)
    if (!nullifierHash) {
      return NextResponse.json(
        { success: false, error: 'API key owner not found' },
        { status: 403, headers: CORS_HEADERS }
      )
    }

    const user = await getUserByNullifier(nullifierHash)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404, headers: CORS_HEADERS }
      )
    }

    // Fetch skin info directly from schema (not in HumanUser type)
    const skinRows = await db
      .select({ activeSkinId: humanUsers.activeSkinId, customHex: humanUsers.customHex })
      .from(humanUsers)
      .where(eq(humanUsers.nullifierHash, nullifierHash))
      .limit(1)
    const skin = skinRows[0]

    return NextResponse.json(
      {
        success: true,
        data: {
          pseudoHandle: user.pseudoHandle ?? null,
          identityMode: user.identityMode,
          isVerified: true,
          karmaScore: user.karmaScore,
          activeSkinId: skin?.activeSkinId ?? 'monochrome',
          customHex: skin?.customHex ?? null,
          createdAt: user.createdAt,
        },
      },
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    console.error('[v1/me GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}

