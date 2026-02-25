import { db } from './index'
import { pollVotes } from './schema'
import { eq, and, sql, inArray } from 'drizzle-orm'
import type { PollResult } from '@/lib/types'

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

/** Batch-fetch poll results for multiple posts in a single query. */
export async function getPollResultsBatch(postIds: string[]): Promise<Record<string, PollResult[]>> {
  if (postIds.length === 0) return {}
  const rows = await db
    .select({
      postId: pollVotes.postId,
      optionIndex: pollVotes.optionIndex,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(pollVotes)
    .where(inArray(pollVotes.postId, postIds))
    .groupBy(pollVotes.postId, pollVotes.optionIndex)

  const result: Record<string, PollResult[]> = {}
  for (const row of rows) {
    if (!result[row.postId]) result[row.postId] = []
    result[row.postId]!.push({ optionIndex: row.optionIndex, count: row.count })
  }
  return result
}

/** Batch-fetch which option each user voted for across multiple polls. */
export async function getUserVotesBatch(
  postIds: string[],
  nullifierHash: string,
): Promise<Record<string, number>> {
  if (postIds.length === 0) return {}
  const rows = await db
    .select({ postId: pollVotes.postId, optionIndex: pollVotes.optionIndex })
    .from(pollVotes)
    .where(and(inArray(pollVotes.postId, postIds), eq(pollVotes.nullifierHash, nullifierHash)))
  return Object.fromEntries(rows.map((r) => [r.postId, r.optionIndex]))
}
