import { db } from './index'
import { communityNotes } from './schema'
import { eq, desc } from 'drizzle-orm'
import type { CommunityNote } from '@/lib/types'

function toNote(row: typeof communityNotes.$inferSelect): CommunityNote {
  return {
    id: row.id,
    postId: row.postId,
    body: row.body,
    submitterNullifierHash: row.submitterNullifierHash,
    helpfulVotes: row.helpfulVotes,
    notHelpfulVotes: row.notHelpfulVotes,
    isPromoted: row.isPromoted,
    createdAt: row.createdAt,
  }
}

export async function createCommunityNote(
  postId: string,
  body: string,
  submitterNullifierHash: string
): Promise<CommunityNote> {
  const [row] = await db
    .insert(communityNotes)
    .values({ postId, body, submitterNullifierHash })
    .returning()
  if (!row) throw new Error('Failed to create community note')
  return toNote(row)
}

export async function getNotesByPostId(postId: string): Promise<CommunityNote[]> {
  const rows = await db
    .select()
    .from(communityNotes)
    .where(eq(communityNotes.postId, postId))
    .orderBy(desc(communityNotes.helpfulVotes))
  return rows.map(toNote)
}
