import { db } from './index'
import { pollVotes } from './schema'
import { eq, and, sql } from 'drizzle-orm'

/**
 * Cast a poll vote. Returns true if vote was recorded, false if already voted
 * (idempotent via unique constraint on postId + nullifierHash).
 */
export async function castPollVote(
  postId: string,
  nullifierHash: string,
  optionIndex: number,
): Promise<boolean> {
  const result = await db
    .insert(pollVotes)
    .values({ postId, nullifierHash, optionIndex })
    .onConflictDoNothing()
    .returning({ id: pollVotes.id })
  return result.length > 0
}

/** Aggregate vote counts by option index for a poll. */
export async function getPollResults(postId: string): Promise<{ optionIndex: number; count: number }[]> {
  const rows = await db
    .select({
      optionIndex: pollVotes.optionIndex,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(pollVotes)
    .where(eq(pollVotes.postId, postId))
    .groupBy(pollVotes.optionIndex)
  return rows
}

/** Returns the option index the user voted for, or null if not voted. */
export async function getUserVote(postId: string, nullifierHash: string): Promise<number | null> {
  const rows = await db
    .select({ optionIndex: pollVotes.optionIndex })
    .from(pollVotes)
    .where(and(eq(pollVotes.postId, postId), eq(pollVotes.nullifierHash, nullifierHash)))
    .limit(1)
  return rows[0]?.optionIndex ?? null
}
