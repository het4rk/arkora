import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getCallerNullifier } from '@/lib/serverAuth'
import { db } from '@/lib/db'
import { humanUsers, posts, replies, dmKeys, dmMessages, notifications, blocks, follows, bookmarks, postVotes, replyVotes, communityNoteVotes, pollVotes, roomParticipants } from '@/lib/db/schema'
import { eq, or } from 'drizzle-orm'
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

    // Clean up all user-associated data before deleting the account
    await Promise.all([
      db.delete(dmKeys).where(eq(dmKeys.nullifierHash, nullifierHash)),
      db.delete(dmMessages).where(or(eq(dmMessages.senderHash, nullifierHash), eq(dmMessages.recipientHash, nullifierHash))),
      db.delete(notifications).where(or(eq(notifications.recipientHash, nullifierHash), eq(notifications.actorHash, nullifierHash))),
      db.delete(blocks).where(or(eq(blocks.blockerHash, nullifierHash), eq(blocks.blockedHash, nullifierHash))),
      db.delete(follows).where(or(eq(follows.followerId, nullifierHash), eq(follows.followedId, nullifierHash))),
      db.delete(bookmarks).where(eq(bookmarks.nullifierHash, nullifierHash)),
      db.delete(postVotes).where(eq(postVotes.nullifierHash, nullifierHash)),
      db.delete(replyVotes).where(eq(replyVotes.nullifierHash, nullifierHash)),
      db.delete(communityNoteVotes).where(eq(communityNoteVotes.nullifierHash, nullifierHash)),
      db.delete(pollVotes).where(eq(pollVotes.nullifierHash, nullifierHash)),
      db.delete(roomParticipants).where(eq(roomParticipants.nullifierHash, nullifierHash)),
    ])

    // Delete the user row (profile data, karma, identity prefs)
    await db.delete(humanUsers).where(eq(humanUsers.nullifierHash, nullifierHash))

    // Clear session cookies
    const cookieStore = await cookies()
    cookieStore.delete('arkora-nh')
    cookieStore.delete('wallet-address')

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/user]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Deletion failed' }, { status: 500 })
  }
}
