import { db } from './index'
import { communityNotes, communityNoteVotes } from './schema'
import { eq, desc, sql } from 'drizzle-orm'
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

/** Upsert a helpful/not-helpful vote, recount, and auto-promote/demote. */
export async function voteOnNote(
  noteId: string,
  nullifierHash: string,
  helpful: boolean
): Promise<CommunityNote> {
  // Upsert vote
  await db.execute(
    sql`INSERT INTO community_note_votes (note_id, nullifier_hash, helpful)
        VALUES (${noteId}, ${nullifierHash}, ${helpful})
        ON CONFLICT (note_id, nullifier_hash)
        DO UPDATE SET helpful = ${helpful}, created_at = now()`
  )

  // Recount + auto-promote: promote when ≥3 helpful AND helpful > notHelpful×2
  const [updated] = await db.execute<{
    helpful_votes: number
    not_helpful_votes: number
    is_promoted: boolean
  }>(
    sql`UPDATE community_notes
        SET
          helpful_votes     = (SELECT COUNT(*) FROM community_note_votes WHERE note_id = ${noteId} AND helpful = true),
          not_helpful_votes = (SELECT COUNT(*) FROM community_note_votes WHERE note_id = ${noteId} AND helpful = false),
          is_promoted = (
            (SELECT COUNT(*) FROM community_note_votes WHERE note_id = ${noteId} AND helpful = true) >= 3
            AND
            (SELECT COUNT(*) FROM community_note_votes WHERE note_id = ${noteId} AND helpful = true)
              > (SELECT COUNT(*) FROM community_note_votes WHERE note_id = ${noteId} AND helpful = false) * 2
          )
        WHERE id = ${noteId}
        RETURNING helpful_votes, not_helpful_votes, is_promoted`
  ) as unknown as [{ helpful_votes: number; not_helpful_votes: number; is_promoted: boolean }]

  const [row] = await db.select().from(communityNotes).where(eq(communityNotes.id, noteId)).limit(1)
  if (!row) throw new Error('Note not found')
  return toNote(row)
}
