import { db } from './index'
import { humanUsers } from './schema'
import { eq, inArray, sql, and } from 'drizzle-orm'
import type { HumanUser } from '@/lib/types'
import { sanitizeText } from '@/lib/sanitize'

/** Public-safe user mapper - walletAddress is always null to prevent leaking in API responses. */
function toUser(row: typeof humanUsers.$inferSelect): HumanUser {
  return {
    nullifierHash: row.nullifierHash,
    walletAddress: null as unknown as string,
    pseudoHandle: row.pseudoHandle ?? null,
    avatarUrl: row.avatarUrl ?? null,
    bio: row.bio ?? null,
    identityMode: (row.identityMode as HumanUser['identityMode']) ?? 'anonymous',
    karmaScore: row.karmaScore ?? 0,
    worldIdVerified: row.worldIdVerified,
    verifiedBlockNumber: row.verifiedBlockNumber !== null ? Number(row.verifiedBlockNumber) : null,
    registrationTxHash: row.registrationTxHash ?? null,
    createdAt: row.createdAt,
  }
}

/** Internal user mapper - includes walletAddress for server-side use (tips, subscriptions, auth linking). */
export function toInternalUser(row: typeof humanUsers.$inferSelect): HumanUser {
  return {
    nullifierHash: row.nullifierHash,
    walletAddress: row.walletAddress,
    pseudoHandle: row.pseudoHandle ?? null,
    avatarUrl: row.avatarUrl ?? null,
    bio: row.bio ?? null,
    identityMode: (row.identityMode as HumanUser['identityMode']) ?? 'anonymous',
    karmaScore: row.karmaScore ?? 0,
    worldIdVerified: row.worldIdVerified,
    verifiedBlockNumber: row.verifiedBlockNumber !== null ? Number(row.verifiedBlockNumber) : null,
    registrationTxHash: row.registrationTxHash ?? null,
    createdAt: row.createdAt,
  }
}

/** Creates or returns user with walletAddress included (server-side auth flows). */
export async function getOrCreateUser(
  nullifierHash: string,
  walletAddress: string,
  username?: string,
  worldIdVerified?: boolean
): Promise<HumanUser> {
  const existing = await getInternalUserByNullifier(nullifierHash)
  if (existing) {
    if (username && !existing.pseudoHandle) {
      return updatePseudoHandle(nullifierHash, username)
    }
    return existing
  }

  const [row] = await db
    .insert(humanUsers)
    .values({
      nullifierHash,
      walletAddress,
      pseudoHandle: username ?? null,
      // Wallet-only (SIWE) users start unverified. World ID verify route sets this to true.
      worldIdVerified: worldIdVerified ?? false,
    })
    .onConflictDoNothing()
    .returning()

  if (!row) {
    const refetch = await getInternalUserByNullifier(nullifierHash)
    if (!refetch) throw new Error('Failed to create user')
    return refetch
  }

  return toUser(row)
}

/** Lightweight fetch for metadata generation - just handle + bio. */
export async function getUserMetadata(nullifierHash: string): Promise<{ pseudoHandle: string | null; bio: string | null } | null> {
  const [row] = await db
    .select({ pseudoHandle: humanUsers.pseudoHandle, bio: humanUsers.bio })
    .from(humanUsers)
    .where(eq(humanUsers.nullifierHash, nullifierHash))
    .limit(1)
  return row ? { pseudoHandle: row.pseudoHandle ?? null, bio: row.bio ?? null } : null
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

/** Same as getUserByNullifier but includes walletAddress - for server-side auth, tips, subscriptions. */
export async function getInternalUserByNullifier(
  nullifierHash: string
): Promise<HumanUser | null> {
  const [row] = await db
    .select()
    .from(humanUsers)
    .where(eq(humanUsers.nullifierHash, nullifierHash))
    .limit(1)

  return row ? toInternalUser(row) : null
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
  return toInternalUser(row)
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
    .set({ bio: bio ? sanitizeText(bio).slice(0, 500) : null })
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

export async function setRegistrationTxHash(nullifierHash: string, txHash: string): Promise<void> {
  await db
    .update(humanUsers)
    .set({ registrationTxHash: txHash })
    .where(eq(humanUsers.nullifierHash, nullifierHash))
}

export async function setWorldIdVerified(nullifierHash: string, blockNumber?: bigint): Promise<void> {
  await db
    .update(humanUsers)
    .set({
      worldIdVerified: true,
      ...(blockNumber !== undefined ? { verifiedBlockNumber: blockNumber } : {}),
    })
    .where(eq(humanUsers.nullifierHash, nullifierHash))
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

/** Look up users by their pseudoHandles - used for @mention notification dispatch. */
export async function getUsersByHandles(handles: string[]): Promise<HumanUser[]> {
  if (handles.length === 0) return []
  const rows = await db
    .select()
    .from(humanUsers)
    .where(inArray(humanUsers.pseudoHandle, handles))
  return rows.map(toUser)
}

export async function getUserByWalletAddressNonWlt(walletAddress: string): Promise<HumanUser | null> {
  const [row] = await db
    .select()
    .from(humanUsers)
    .where(and(
      eq(humanUsers.walletAddress, walletAddress),
      sql`${humanUsers.nullifierHash} NOT LIKE 'wlt_%'`
    ))
    .limit(1)
  return row ? toInternalUser(row) : null
}

export async function isVerifiedHuman(nullifierHash: string): Promise<boolean> {
  const [row] = await db
    .select({ v: sql<number>`1` })
    .from(humanUsers)
    .where(and(
      eq(humanUsers.nullifierHash, nullifierHash),
      eq(humanUsers.worldIdVerified, true)
    ))
    .limit(1)
  return !!row
}
