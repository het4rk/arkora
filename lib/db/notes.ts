import { db } from './index'
import { communityNotes } from './schema'
import { eq, sql } from 'drizzle-orm'
import type { CommunityNote, CreateNoteInput } from '@/lib/types'

const PROMOTED_THRESHOLD = 5 // helpful:unhelpful ratio votes to auto-promote

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

export async function createNote(input: CreateNoteInput): Promise<CommunityNote> {
  const [row] = await db
    .insert(communityNotes)
    .values({
      postId: input.postId,
      body: input.body,
      submitterNullifierHash: input.submitterNullifierHash,
    })
    .returning()

  if (!row) throw new Error('Failed to create note')
  return toNote(row)
}

export async function getNotesByPostId(postId: string): Promise<CommunityNote[]> {
  const rows = await db
    .select()
    .from(communityNotes)
    .where(eq(communityNotes.postId, postId))
    .orderBy(sql`${communityNotes.isPromoted} DESC, ${communityNotes.helpfulVotes} DESC`)

  return rows.map(toNote)
}

export async function voteOnNote(
  noteId: string,
  isHelpful: boolean
): Promise<CommunityNote> {
  const field = isHelpful ? communityNotes.helpfulVotes : communityNotes.notHelpfulVotes

  const [row] = await db
    .update(communityNotes)
    .set({ [isHelpful ? 'helpfulVotes' : 'notHelpfulVotes']: sql`${field} + 1` })
    .where(eq(communityNotes.id, noteId))
    .returning()

  if (!row) throw new Error('Note not found')

  // Auto-promote if enough helpful votes and ratio is good
  if (
    row.helpfulVotes >= PROMOTED_THRESHOLD &&
    row.helpfulVotes > row.notHelpfulVotes * 2
  ) {
    await db
      .update(communityNotes)
      .set({ isPromoted: true })
      .where(eq(communityNotes.id, noteId))
    return { ...toNote(row), isPromoted: true }
  }

  return toNote(row)
}
