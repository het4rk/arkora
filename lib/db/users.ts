import { db } from './index'
import { humanUsers } from './schema'
import { eq } from 'drizzle-orm'
import type { HumanUser } from '@/lib/types'

function toUser(row: typeof humanUsers.$inferSelect): HumanUser {
  return {
    nullifierHash: row.nullifierHash,
    walletAddress: row.walletAddress,
    pseudoHandle: row.pseudoHandle ?? null,
    createdAt: row.createdAt,
  }
}

export async function getOrCreateUser(
  nullifierHash: string,
  walletAddress: string
): Promise<HumanUser> {
  const existing = await getUserByNullifier(nullifierHash)
  if (existing) return existing

  const [row] = await db
    .insert(humanUsers)
    .values({ nullifierHash, walletAddress })
    .onConflictDoNothing()
    .returning()

  // Race condition: another request created it first
  if (!row) {
    const refetch = await getUserByNullifier(nullifierHash)
    if (!refetch) throw new Error('Failed to create user')
    return refetch
  }

  return toUser(row)
}

export async function getUserByNullifier(
  nullifierHash: string
): Promise<HumanUser | null> {
  const [row] = await db
    .select()
    .from(humanUsers)
    .where(eq(humanUsers.nullifierHash, nullifierHash))
    .limit(1)

  return row ? toUser(row) : null
}

export async function updatePseudoHandle(
  nullifierHash: string,
  pseudoHandle: string
): Promise<HumanUser> {
  const [row] = await db
    .update(humanUsers)
    .set({ pseudoHandle })
    .where(eq(humanUsers.nullifierHash, nullifierHash))
    .returning()

  if (!row) throw new Error('User not found')
  return toUser(row)
}

export async function isVerifiedHuman(nullifierHash: string): Promise<boolean> {
  const user = await getUserByNullifier(nullifierHash)
  return user !== null
}
