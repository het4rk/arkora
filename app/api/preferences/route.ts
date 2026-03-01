import { NextRequest, NextResponse } from 'next/server'
import { getCallerNullifier } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'
import { db } from '@/lib/db'
import { humanUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const VALID_THEMES = new Set(['dark', 'light'])

/** Returns synced preferences for the authenticated user. */
export async function GET() {
  const nullifierHash = await getCallerNullifier()
  if (!nullifierHash) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  }

  const [row] = await db
    .select({
      theme: humanUsers.theme,
      notifyReplies: humanUsers.notifyReplies,
      notifyDms: humanUsers.notifyDms,
      notifyFollows: humanUsers.notifyFollows,
      notifyFollowedPosts: humanUsers.notifyFollowedPosts,
      locationEnabled: humanUsers.locationEnabled,
      locationRadius: humanUsers.locationRadius,
    })
    .from(humanUsers)
    .where(eq(humanUsers.nullifierHash, nullifierHash))
    .limit(1)

  if (!row) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: row })
}

/** Updates one or more synced preferences. */
export async function PATCH(req: NextRequest) {
  const nullifierHash = await getCallerNullifier()
  if (!nullifierHash) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  }

  if (!rateLimit(`prefs:${nullifierHash}`, 30, 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }

  const body = (await req.json()) as Record<string, unknown>
  const updates: Record<string, unknown> = {}

  if (typeof body.theme === 'string' && VALID_THEMES.has(body.theme)) {
    updates.theme = body.theme
  }
  if (typeof body.notifyReplies === 'boolean') {
    updates.notifyReplies = body.notifyReplies
  }
  if (typeof body.notifyDms === 'boolean') {
    updates.notifyDms = body.notifyDms
  }
  if (typeof body.notifyFollows === 'boolean') {
    updates.notifyFollows = body.notifyFollows
  }
  if (typeof body.notifyFollowedPosts === 'boolean') {
    updates.notifyFollowedPosts = body.notifyFollowedPosts
  }
  if (typeof body.locationEnabled === 'boolean') {
    updates.locationEnabled = body.locationEnabled
  }
  if (typeof body.locationRadius === 'number' && Number.isFinite(body.locationRadius)) {
    updates.locationRadius = body.locationRadius
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 })
  }

  await db
    .update(humanUsers)
    .set(updates)
    .where(eq(humanUsers.nullifierHash, nullifierHash))

  return NextResponse.json({ success: true })
}
