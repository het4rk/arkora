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
  // Wraps DISTINCT ON in a subquery so the outer ORDER BY last_message_at DESC
  // can sort conversations without conflicting with the DISTINCT ON ordering rule.
  const rows = await db.execute(sql`
    SELECT * FROM (
      SELECT DISTINCT ON (
        CASE WHEN sender_hash = ${myHash} THEN recipient_hash ELSE sender_hash END
      )
        CASE WHEN sender_hash = ${myHash} THEN recipient_hash ELSE sender_hash END AS other_hash,
        created_at   AS last_message_at,
        ciphertext   AS last_ciphertext,
        nonce        AS last_nonce,
        sender_hash  AS last_sender_hash
      FROM dm_messages
      WHERE sender_hash = ${myHash} OR recipient_hash = ${myHash}
      ORDER BY
        CASE WHEN sender_hash = ${myHash} THEN recipient_hash ELSE sender_hash END,
        created_at DESC
    ) sub
    ORDER BY last_message_at DESC
  `)

  const rawRows = rows as unknown as Array<{
    other_hash: string
    last_message_at: Date
    last_ciphertext: string
    last_nonce: string
    last_sender_hash: string
  }>

  if (rawRows.length === 0) return []

  // Fetch user info for all conversation partners in a single query
  const otherHashes = rawRows.map((r) => r.other_hash)
  const users = await db
    .select({ nullifierHash: humanUsers.nullifierHash, pseudoHandle: humanUsers.pseudoHandle, avatarUrl: humanUsers.avatarUrl })
    .from(humanUsers)
    .where(inArray(humanUsers.nullifierHash, otherHashes))

  const userMap = new Map(users.map((u) => [u.nullifierHash, u]))

  // DB already sorted by last_message_at DESC — no in-app sort needed
  return rawRows.map((r) => {
    const u = userMap.get(r.other_hash)
    return {
      otherHash: r.other_hash,
      otherHandle: u?.pseudoHandle ?? null,
      otherAvatarUrl: u?.avatarUrl ?? null,
      lastMessageAt: new Date(r.last_message_at),
      lastCiphertext: r.last_ciphertext,
      lastNonce: r.last_nonce,
      lastSenderHash: r.last_sender_hash,
    }
  })
}
