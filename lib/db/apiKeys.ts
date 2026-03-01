import { db } from '@/lib/db'
import { apiKeys } from './schema'
import { eq, and, isNull, desc, sql } from 'drizzle-orm'
import { scryptSync, randomBytes } from 'crypto'

// Server-side salt for API key hashing (scrypt provides computational effort).
// Derived from DATABASE_URL - stable across deploys, never client-exposed.
const KEY_SALT = process.env.DATABASE_URL ?? 'arkora-api-key-hash-fallback'

function hashKey(raw: string): string {
  return scryptSync(raw, KEY_SALT, 32, { N: 4096, r: 8, p: 1 }).toString('hex')
}

/** Generates a new API key pair: raw (shown once) + scrypt hash (stored). */
export function generateApiKey(): { raw: string; hash: string } {
  const raw = 'ark_' + randomBytes(32).toString('hex')
  const hash = hashKey(raw)
  return { raw, hash }
}

/** Creates a new API key for the given user. Returns the row + the raw key (shown once). */
export async function createApiKey(
  nullifierHash: string,
  label: string
): Promise<{ id: string; label: string; createdAt: Date; raw: string }> {
  const { raw, hash } = generateApiKey()
  const [row] = await db
    .insert(apiKeys)
    .values({ nullifierHash, keyHash: hash, label: label.slice(0, 64) })
    .returning({ id: apiKeys.id, label: apiKeys.label, createdAt: apiKeys.createdAt })
  return { ...row!, raw }
}

/** Lists active (non-revoked) API keys for a user (without keyHash). */
export async function getApiKeysByOwner(nullifierHash: string) {
  return db
    .select({
      id: apiKeys.id,
      label: apiKeys.label,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.nullifierHash, nullifierHash), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt))
}

/** Returns the count of non-revoked keys for a user. */
export async function countActiveKeysByOwner(nullifierHash: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(apiKeys)
    .where(and(eq(apiKeys.nullifierHash, nullifierHash), isNull(apiKeys.revokedAt)))
  return rows[0]?.count ?? 0
}

/** Revokes a key by ID, ensuring it belongs to the caller. Returns false if not found or already revoked. */
export async function revokeApiKey(id: string, nullifierHash: string): Promise<boolean> {
  const result = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiKeys.id, id),
        eq(apiKeys.nullifierHash, nullifierHash),
        isNull(apiKeys.revokedAt)
      )
    )
    .returning({ id: apiKeys.id })
  return result.length > 0
}

/**
 * Validates a raw API key. Returns true and touches lastUsedAt if valid and not revoked.
 * Returns false for any invalid/revoked/malformed key.
 */
export async function validateApiKey(raw: string): Promise<boolean> {
  if (!raw.startsWith('ark_') || raw.length !== 68) return false
  const hash = hashKey(raw)
  const rows = await db
    .select({ id: apiKeys.id, revokedAt: apiKeys.revokedAt })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hash))
    .limit(1)
  const row = rows[0]
  if (!row || row.revokedAt) return false
  // Fire-and-forget: update lastUsedAt without blocking
  void db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .execute()
    .catch(() => undefined)
  return true
}
