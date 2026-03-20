import { db } from '@/lib/db'
import { cliSessions } from './schema'
import { eq, and, gt, isNull } from 'drizzle-orm'
import { randomBytes } from 'crypto'

const SESSION_TTL_MS = 5 * 60 * 1000 // 5 minutes

/** Creates a pending CLI session. Returns the token and expiry. */
export async function createCliSession(ipAddress: string) {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

  await db.insert(cliSessions).values({
    token,
    ipAddress,
    expiresAt,
  })

  return { token, expiresAt }
}

/** Returns a pending, non-expired, non-consumed session by token. */
export async function getPendingCliSession(token: string) {
  const rows = await db
    .select()
    .from(cliSessions)
    .where(
      and(
        eq(cliSessions.token, token),
        eq(cliSessions.status, 'pending'),
        gt(cliSessions.expiresAt, new Date()),
        isNull(cliSessions.consumedAt)
      )
    )
    .limit(1)
  return rows[0] ?? null
}

/** Atomically authorizes a pending session. Returns true if updated. */
export async function authorizeCliSession(
  token: string,
  nullifierHash: string,
  rawApiKey: string
): Promise<boolean> {
  const result = await db
    .update(cliSessions)
    .set({
      status: 'authorized',
      nullifierHash,
      apiKey: rawApiKey,
    })
    .where(
      and(
        eq(cliSessions.token, token),
        eq(cliSessions.status, 'pending'),
        gt(cliSessions.expiresAt, new Date()),
        isNull(cliSessions.consumedAt)
      )
    )
    .returning({ id: cliSessions.id })
  return result.length > 0
}

/** Atomically consumes an authorized session. Returns the API key exactly once. */
export async function consumeCliSession(token: string): Promise<string | null> {
  const result = await db
    .update(cliSessions)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(cliSessions.token, token),
        eq(cliSessions.status, 'authorized'),
        gt(cliSessions.expiresAt, new Date()),
        isNull(cliSessions.consumedAt)
      )
    )
    .returning({ apiKey: cliSessions.apiKey })
  return result[0]?.apiKey ?? null
}
