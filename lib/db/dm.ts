import { db } from './index'
import { dmKeys, dmMessages, humanUsers } from './schema'
import { eq, or, and, desc, inArray, sql } from 'drizzle-orm'

// ── Key registry ──────────────────────────────────────────────────────────────

export async function upsertDmKey(nullifierHash: string, publicKey: string): Promise<void> {
  await db
    .insert(dmKeys)
    .values({ nullifierHash, publicKey })
    .onConflictDoUpdate({
      target: dmKeys.nullifierHash,
      set: { publicKey, updatedAt: sql`now()` },
    })
}

export async function getDmKey(nullifierHash: string): Promise<string | null> {
  const [row] = await db
    .select({ publicKey: dmKeys.publicKey })
    .from(dmKeys)
    .where(eq(dmKeys.nullifierHash, nullifierHash))
    .limit(1)
  return row?.publicKey ?? null
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function saveDmMessage(
  senderHash: string,
  recipientHash: string,
  ciphertext: string,
  nonce: string
): Promise<string> {
  const [row] = await db
    .insert(dmMessages)
    .values({ senderHash, recipientHash, ciphertext, nonce })
    .returning({ id: dmMessages.id })
  if (!row) throw new Error('Failed to save message')
  return row.id
}

export interface RawDmMessage {
  id: string
  senderHash: string
  recipientHash: string
  ciphertext: string
  nonce: string
  createdAt: Date
}

export async function getDmMessages(
  myHash: string,
  otherHash: string,
  cursor?: string,  // fetch BEFORE this ISO timestamp (pagination)
  since?: string,   // fetch AFTER this ISO timestamp (polling for new messages)
  limit = 50
): Promise<RawDmMessage[]> {
  const conditions = [
    or(
      and(eq(dmMessages.senderHash, myHash), eq(dmMessages.recipientHash, otherHash)),
      and(eq(dmMessages.senderHash, otherHash), eq(dmMessages.recipientHash, myHash))
    )!,
  ]
  if (cursor) {
    conditions.push(sql`${dmMessages.createdAt} < ${new Date(cursor)}` as ReturnType<typeof eq>)
  }
  if (since) {
    conditions.push(sql`${dmMessages.createdAt} > ${new Date(since)}` as ReturnType<typeof eq>)
  }

  const rows = await db
    .select()
    .from(dmMessages)
    .where(and(...conditions))
    .orderBy(desc(dmMessages.createdAt))
    .limit(Math.min(limit, 100))

  return rows.map((r) => ({
    id: r.id,
    senderHash: r.senderHash,
    recipientHash: r.recipientHash,
    ciphertext: r.ciphertext,
    nonce: r.nonce,
    createdAt: r.createdAt,
  }))
}

// ── Conversation list ─────────────────────────────────────────────────────────

export interface ConversationSummary {
  otherHash: string
  otherHandle: string | null
  otherAvatarUrl: string | null
  lastMessageAt: Date
  lastCiphertext: string
  lastNonce: string
  lastSenderHash: string
}

export async function getConversations(myHash: string): Promise<ConversationSummary[]> {
  // Get all messages involving this user, then deduplicate in JS.
  // The previous DISTINCT ON approach broke with parameterized queries because
  // Postgres sees $1/$2/$3 as distinct expressions even when values are identical.
  const rows = await db
    .select({
      senderHash: dmMessages.senderHash,
      recipientHash: dmMessages.recipientHash,
      createdAt: dmMessages.createdAt,
      ciphertext: dmMessages.ciphertext,
      nonce: dmMessages.nonce,
    })
    .from(dmMessages)
    .where(or(
      eq(dmMessages.senderHash, myHash),
      eq(dmMessages.recipientHash, myHash),
    ))
    .orderBy(desc(dmMessages.createdAt))

  if (rows.length === 0) return []

  // Deduplicate: keep only the most recent message per conversation partner
  const seen = new Map<string, typeof rows[number]>()
  for (const row of rows) {
    const otherHash = row.senderHash === myHash ? row.recipientHash : row.senderHash
    if (!seen.has(otherHash)) seen.set(otherHash, row)
  }

  const rawRows = Array.from(seen.entries())

  // Fetch user info for all conversation partners in a single query
  const otherHashes = rawRows.map(([hash]) => hash)
  const users = await db
    .select({ nullifierHash: humanUsers.nullifierHash, pseudoHandle: humanUsers.pseudoHandle, avatarUrl: humanUsers.avatarUrl })
    .from(humanUsers)
    .where(inArray(humanUsers.nullifierHash, otherHashes))

  const userMap = new Map(users.map((u) => [u.nullifierHash, u]))

  // Already sorted by most recent first (rows were ordered by createdAt DESC)
  return rawRows.map(([otherHash, row]) => {
    const u = userMap.get(otherHash)
    return {
      otherHash,
      otherHandle: u?.pseudoHandle ?? null,
      otherAvatarUrl: u?.avatarUrl ?? null,
      lastMessageAt: new Date(row.createdAt),
      lastCiphertext: row.ciphertext,
      lastNonce: row.nonce,
      lastSenderHash: row.senderHash,
    }
  })
}
