import { db } from './index'
import { humanUsers } from './schema'
import { eq, sql } from 'drizzle-orm'

// Re-export pure tier utilities from client-safe module
export type { KarmaTier, KarmaTierConfig } from '@/lib/karma'
export { KARMA_TIERS, getKarmaTier } from '@/lib/karma'

/**
 * Increment or decrement a user's karma score.
 * delta can be positive or negative.
 * Fire-and-forget — never throws (errors are swallowed).
 */
export async function updateKarma(nullifierHash: string, delta: number): Promise<void> {
  if (delta === 0) return
  await db
    .update(humanUsers)
    .set({ karmaScore: sql`${humanUsers.karmaScore} + ${delta}` })
    .where(eq(humanUsers.nullifierHash, nullifierHash))
}

/**
 * Recompute a user's karma from scratch based on actual vote counts.
 * Use this for backfilling existing users or correcting drift.
 * Returns the recomputed score.
 */
export async function recomputeKarma(nullifierHash: string): Promise<number> {
  const [result] = await db.execute<{ karma_score: string | number }>(
    sql`
      WITH post_karma AS (
        SELECT COALESCE(SUM(upvotes - downvotes), 0) AS score
        FROM posts
        WHERE nullifier_hash = ${nullifierHash}
      ),
      reply_karma AS (
        SELECT COALESCE(SUM(upvotes - downvotes), 0) AS score
        FROM replies
        WHERE nullifier_hash = ${nullifierHash}
      )
      UPDATE human_users
      SET karma_score = (SELECT score FROM post_karma) + (SELECT score FROM reply_karma)
      WHERE nullifier_hash = ${nullifierHash}
      RETURNING karma_score
    `
  )
  return Number(result?.karma_score ?? 0)
}

/** Fast lookup of a single user's karma score. Used in the post detail API. */
export async function getKarmaScore(nullifierHash: string): Promise<number> {
  const [row] = await db
    .select({ karmaScore: humanUsers.karmaScore })
    .from(humanUsers)
    .where(eq(humanUsers.nullifierHash, nullifierHash))
    .limit(1)
  return row?.karmaScore ?? 0
}
