import { db } from './index'
import { humanUsers } from './schema'
import { eq, inArray, sql } from 'drizzle-orm'
import type { HumanUser } from '@/lib/types'

function toUser(row: typeof humanUsers.$inferSelect): HumanUser {
  return {
    nullifierHash: row.nullifierHash,
    walletAddress: row.walletAddress,
    pseudoHandle: row.pseudoHandle ?? null,
    avatarUrl: row.avatarUrl ?? null,
    bio: row.bio ?? null,
    identityMode: (row.identityMode as HumanUser['identityMode']) ?? 'anonymous',
    karmaScore: row.karmaScore ?? 0,
    createdAt: row.createdAt,
  }
}

export async function getOrCreateUser(
  nullifierHash: string,
  walletAddress: string,
  username?: string
): Promise<HumanUser> {
  const existing = await getUserByNullifier(nullifierHash)
  if (existing) {
    if (username && !existing.pseudoHandle) {
      return updatePseudoHandle(nullifierHash, username)
    }
    return existing
  }

  const [row] = await db
    .insert(humanUsers)
    .values({ nullifierHash, walletAddress, pseudoHandle: username ?? null })
    .onConflictDoNothing()
    .returning()

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

export async function updateAvatarUrl(
  nullifierHash: string,
  avatarUrl: string | null
): Promise<HumanUser> {
  const [row] = await db
    .update(humanUsers)
    .set({ avatarUrl })
    .where(eq(humanUsers.nullifierHash, nullifierHash))
    .returning()

  if (!row) throw new Error('User not found')
  return toUser(row)
}

export async function updateBio(
  nullifierHash: string,
  bio: string | null
): Promise<HumanUser> {
  const [row] = await db
    .update(humanUsers)
    .set({ bio: bio ? bio.slice(0, 160) : null })
    .where(eq(humanUsers.nullifierHash, nullifierHash))
    .returning()

  if (!row) throw new Error('User not found')
  return toUser(row)
}

export async function updateIdentityMode(
  nullifierHash: string,
  identityMode: 'anonymous' | 'alias' | 'named'
): Promise<void> {
  await db.update(humanUsers).set({ identityMode }).where(eq(humanUsers.nullifierHash, nullifierHash))
}

export async function getUsersByNullifiers(
  hashes: string[]
): Promise<Map<string, HumanUser>> {
  if (hashes.length === 0) return new Map()
  const rows = await db
    .select()
    .from(humanUsers)
    .where(inArray(humanUsers.nullifierHash, hashes))
  const map = new Map<string, HumanUser>()
  for (const row of rows) map.set(row.nullifierHash, toUser(row))
  return map
}

export async function isVerifiedHuman(nullifierHash: string): Promise<boolean> {
  const [row] = await db
    .select({ v: sql<number>`1` })
    .from(humanUsers)
    .where(eq(humanUsers.nullifierHash, nullifierHash))
    .limit(1)
  return !!row
}

