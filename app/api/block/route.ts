import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { blocks } from '@/lib/db/schema'
import { isVerifiedHuman } from '@/lib/db/users'
import { rateLimit } from '@/lib/rateLimit'
import { getCallerNullifier } from '@/lib/serverAuth'
import { and, eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await isVerifiedHuman(nullifierHash))) {
      return NextResponse.json({ success: false, error: 'Verification required' }, { status: 403 })
    }

    if (!rateLimit(`block:${nullifierHash}`, 30, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    const { targetHash } = (await req.json()) as { targetHash?: string }
    if (!targetHash?.trim()) {
      return NextResponse.json({ success: false, error: 'Missing target' }, { status: 400 })
    }

    if (targetHash === nullifierHash) {
      return NextResponse.json({ success: false, error: 'Cannot block yourself' }, { status: 400 })
    }

    // Toggle: if already blocked, unblock
    const existing = await db
      .select({ blockerHash: blocks.blockerHash })
      .from(blocks)
      .where(and(eq(blocks.blockerHash, nullifierHash), eq(blocks.blockedHash, targetHash)))
      .limit(1)

    if (existing.length > 0) {
      await db.delete(blocks).where(
        and(eq(blocks.blockerHash, nullifierHash), eq(blocks.blockedHash, targetHash))
      )
      return NextResponse.json({ success: true, data: { blocked: false } })
    }

    await db.insert(blocks).values({
      blockerHash: nullifierHash,
      blockedHash: targetHash,
    })

    return NextResponse.json({ success: true, data: { blocked: true } }, { status: 201 })
  } catch (err) {
    console.error('[block POST]', err)
    return NextResponse.json({ success: false, error: 'Failed to update block' }, { status: 500 })
  }
}

/** Get list of blocked user hashes */
export async function GET() {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const rows = await db
      .select({ blockedHash: blocks.blockedHash })
      .from(blocks)
      .where(eq(blocks.blockerHash, nullifierHash))

    return NextResponse.json({ success: true, data: rows.map((r) => r.blockedHash) })
  } catch (err) {
    console.error('[block GET]', err)
    return NextResponse.json({ success: false, error: 'Failed to fetch blocks' }, { status: 500 })
  }
}
