import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { postVotes, humanUsers } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getCallerNullifier } from '@/lib/serverAuth'
import { isVerifiedHuman } from '@/lib/db/users'
import { rateLimit } from '@/lib/rateLimit'

// GET /api/vote/reactions?postId=X
// Returns identity-aware voter lists (no nullifier hashes exposed)
export async function GET(req: NextRequest) {
  try {
    const callerHash = await getCallerNullifier()
    if (!callerHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await isVerifiedHuman(callerHash))) {
      return NextResponse.json({ success: false, error: 'Verification required' }, { status: 403 })
    }

    if (!rateLimit(`reactions:${callerHash}`, 30, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    const postId = new URL(req.url).searchParams.get('postId')
    if (!postId) {
      return NextResponse.json({ success: false, error: 'Missing postId' }, { status: 400 })
    }

    // Fetch up to 50 voters per direction with their identity info (single JOIN)
    const rows = await db
      .select({
        direction: postVotes.direction,
        identityMode: humanUsers.identityMode,
        pseudoHandle: humanUsers.pseudoHandle,
      })
      .from(postVotes)
      .leftJoin(humanUsers, eq(postVotes.nullifierHash, humanUsers.nullifierHash))
      .where(eq(postVotes.postId, postId))
      .limit(100)

    const upvoters: { display: string }[] = []
    const downvoters: { display: string }[] = []

    for (const row of rows) {
      const display =
        row.identityMode && row.identityMode !== 'anonymous' && row.pseudoHandle
          ? row.pseudoHandle
          : 'Someone'

      if (row.direction === 1 && upvoters.length < 50) {
        upvoters.push({ display })
      } else if (row.direction === -1 && downvoters.length < 50) {
        downvoters.push({ display })
      }
    }

    return NextResponse.json({ success: true, data: { upvoters, downvoters } })
  } catch (err) {
    console.error('[vote/reactions GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to fetch reactions' }, { status: 500 })
  }
}
