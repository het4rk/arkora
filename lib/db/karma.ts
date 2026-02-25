import { db } from './index'
import { humanUsers, posts, replies } from './schema'
import { eq, sql } from 'drizzle-orm'

export type KarmaTier = 'newcomer' | 'contributor' | 'trusted' | 'elder'

export interface KarmaTierConfig {
  tier: KarmaTier
  label: string
  minScore: number
  color: string // Tailwind text color class
  bg: string    // Tailwind bg color class
}

export const KARMA_TIERS: KarmaTierConfig[] = [
  { tier: 'newcomer',    label: 'Newcomer',    minScore: 0,   color: 'text-text-muted',       bg: 'bg-surface-up' },
  { tier: 'contributor', label: 'Contributor', minScore: 10,  color: 'text-emerald-400',       bg: 'bg-emerald-400/15' },
  { tier: 'trusted',     label: 'Trusted',     minScore: 100, color: 'text-accent',            bg: 'bg-accent/15' },
  { tier: 'elder',       label: 'Elder',       minScore: 500, color: 'text-amber-400',         bg: 'bg-amber-400/15' },
]

export function getKarmaTier(score: number): KarmaTierConfig {
  // Walk tiers in descending order to find the highest achieved tier
  for (let i = KARMA_TIERS.length - 1; i >= 0; i--) {
    const tier = KARMA_TIERS[i]!
    if (score >= tier.minScore) return tier
  }
  return KARMA_TIERS[0]!
}

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
  const [result] = await db.execute<{ karma: string | number }>(
    sql`
      WITH post_karma AS (
        SELECT COALESCE(SUM(upvotes - downvotes), 0) AS score
        FROM posts
        WHERE nullifier_hash = ${nullifierHash} AND deleted_at IS NULL
      ),
      reply_karma AS (
        SELECT COALESCE(SUM(upvotes - downvotes), 0) AS score
        FROM replies
        WHERE nullifier_hash = ${nullifierHash} AND deleted_at IS NULL
      )
      UPDATE human_users
      SET karma_score = (SELECT score FROM post_karma) + (SELECT score FROM reply_karma)
      WHERE nullifier_hash = ${nullifierHash}
      RETURNING karma_score
    `
  )
  return Number(result?.karma ?? 0)
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
