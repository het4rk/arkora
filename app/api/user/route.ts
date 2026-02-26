import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getCallerNullifier } from '@/lib/serverAuth'
import { db } from '@/lib/db'
import { humanUsers, posts, replies } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { rateLimit } from '@/lib/rateLimit'

/**
 * DELETE /api/user
 * GDPR-compliant account deletion.
 * - Dissociates posts + replies from the nullifier (replaced with a random dead hash per-row)
 * - Removes all personal profile data
 * - Deletes the humanUsers row
 * - Clears session cookies
 */
export async function DELETE() {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!rateLimit(`delete-account:${nullifierHash}`, 2, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    // Anonymize posts: replace nullifierHash with a random dead value, strip pseudoHandle
    const deadPostHash = `deleted_${crypto.randomUUID().replace(/-/g, '')}`
    await db
      .update(posts)
      .set({ nullifierHash: deadPostHash, pseudoHandle: null })
      .where(eq(posts.nullifierHash, nullifierHash))

    // Anonymize replies similarly
    const deadReplyHash = `deleted_${crypto.randomUUID().replace(/-/g, '')}`
    await db
      .update(replies)
      .set({ nullifierHash: deadReplyHash, pseudoHandle: null })
      .where(eq(replies.nullifierHash, nullifierHash))

    // Delete the user row (profile data, karma, identity prefs)
    await db.delete(humanUsers).where(eq(humanUsers.nullifierHash, nullifierHash))

    // Clear session cookies
    const cookieStore = await cookies()
    cookieStore.delete('arkora-nh')
    cookieStore.delete('wallet-address')

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/user]', err)
    return NextResponse.json({ success: false, error: 'Deletion failed' }, { status: 500 })
  }
}
