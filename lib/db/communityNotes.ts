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
    .limit(10)
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
  // RETURNING all fields avoids a second round-trip to the DB.
  const [updated] = await db.execute<{
    id: string
    post_id: string
    body: string
    submitter_nullifier_hash: string
    helpful_votes: number
    not_helpful_votes: number
    is_promoted: boolean
    created_at: string
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
        RETURNING id, post_id, body, submitter_nullifier_hash,
                  helpful_votes, not_helpful_votes, is_promoted, created_at`
  ) as unknown as [{
    id: string; post_id: string; body: string; submitter_nullifier_hash: string
    helpful_votes: number; not_helpful_votes: number; is_promoted: boolean; created_at: string
  }]

  if (!updated) throw new Error('Note not found')
  return {
    id: updated.id,
    postId: updated.post_id,
    body: updated.body,
    submitterNullifierHash: updated.submitter_nullifier_hash,
    helpfulVotes: Number(updated.helpful_votes),
    notHelpfulVotes: Number(updated.not_helpful_votes),
    isPromoted: updated.is_promoted,
    createdAt: new Date(updated.created_at),
  }
}

type NoteRow = {
  id: string; post_id: string; body: string; submitter_nullifier_hash: string
  helpful_votes: number; not_helpful_votes: number; is_promoted: boolean; created_at: string
}

/** Delete a note vote, recount, and auto-promote/demote. */
export async function deleteNoteVote(
  noteId: string,
  nullifierHash: string
): Promise<CommunityNote> {
  // Two separate statements so the COUNT(*) sees the post-DELETE state.
  await db.execute(
    sql`DELETE FROM community_note_votes WHERE note_id = ${noteId} AND nullifier_hash = ${nullifierHash}`
  )

  const [updated] = await db.execute<NoteRow>(
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
        RETURNING id, post_id, body, submitter_nullifier_hash,
                  helpful_votes, not_helpful_votes, is_promoted, created_at`
  ) as unknown as [NoteRow]

  if (!updated) throw new Error('Note not found')
  return {
    id: updated.id,
    postId: updated.post_id,
    body: updated.body,
    submitterNullifierHash: updated.submitter_nullifier_hash,
    helpfulVotes: Number(updated.helpful_votes),
    notHelpfulVotes: Number(updated.not_helpful_votes),
    isPromoted: updated.is_promoted,
    createdAt: new Date(updated.created_at),
  }
}
