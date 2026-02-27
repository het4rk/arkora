import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { reports } from '@/lib/db/schema'
import { isVerifiedHuman } from '@/lib/db/users'
import { incrementReportCount } from '@/lib/db/posts'
import { rateLimit } from '@/lib/rateLimit'
import { getCallerNullifier } from '@/lib/serverAuth'
import { sanitizeText } from '@/lib/sanitize'
import { and, eq } from 'drizzle-orm'

const VALID_TARGET_TYPES = new Set(['post', 'reply', 'user'])
const VALID_REASONS = new Set(['spam', 'harassment', 'hate', 'violence', 'misinformation', 'other'])

export async function POST(req: NextRequest) {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await isVerifiedHuman(nullifierHash))) {
      return NextResponse.json({ success: false, error: 'Verification required' }, { status: 403 })
    }

    // Rate limit: 10 reports per minute
    if (!rateLimit(`report:${nullifierHash}`, 10, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many reports. Slow down.' }, { status: 429 })
    }

    const body = (await req.json()) as {
      targetType?: string
      targetId?: string
      reason?: string
      details?: string
    }

    if (!body.targetType || !VALID_TARGET_TYPES.has(body.targetType)) {
      return NextResponse.json({ success: false, error: 'Invalid target type' }, { status: 400 })
    }
    if (!body.targetId?.trim()) {
      return NextResponse.json({ success: false, error: 'Missing target' }, { status: 400 })
    }
    if (!body.reason || !VALID_REASONS.has(body.reason)) {
      return NextResponse.json({ success: false, error: 'Invalid reason' }, { status: 400 })
    }

    // Prevent duplicate reports
    const existing = await db
      .select({ id: reports.id })
      .from(reports)
      .where(and(
        eq(reports.reporterHash, nullifierHash),
        eq(reports.targetType, body.targetType),
        eq(reports.targetId, body.targetId)
      ))
      .limit(1)

    if (existing.length > 0) {
      return NextResponse.json({ success: true, data: { alreadyReported: true } })
    }

    await db.insert(reports).values({
      reporterHash: nullifierHash,
      targetType: body.targetType,
      targetId: body.targetId,
      reason: body.reason,
      details: body.details ? sanitizeText(body.details).slice(0, 500) : null,
    })

    // Auto-hide posts after 5 unique reports - fire-and-forget
    if (body.targetType === 'post') {
      void incrementReportCount(body.targetId).catch(() => { /* non-critical */ })
    }

    return NextResponse.json({ success: true, data: { reported: true } }, { status: 201 })
  } catch (err) {
    console.error('[report POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Failed to submit report' }, { status: 500 })
  }
}
