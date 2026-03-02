import { db } from './index'
import { notifications, humanUsers } from './schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import type { Notification } from '@/lib/types'

function toNotification(row: typeof notifications.$inferSelect): Notification {
  return {
    id: row.id,
    recipientHash: row.recipientHash,
    type: row.type as Notification['type'],
    referenceId: row.referenceId ?? null,
    actorHash: row.actorHash ?? null,
    read: row.read,
    createdAt: row.createdAt,
  }
}

/** Map notification types to user preference columns. Types not listed always fire. */
const PREF_MAP: Partial<Record<Notification['type'], 'notifyReplies' | 'notifyDms' | 'notifyFollows'>> = {
  reply: 'notifyReplies',
  dm: 'notifyDms',
  follow: 'notifyFollows',
}

export async function createNotification(
  recipientHash: string,
  type: Notification['type'],
  referenceId?: string,
  actorHash?: string
): Promise<void> {
  // Check recipient preference before creating notification
  const prefCol = PREF_MAP[type]
  if (prefCol) {
    const [user] = await db
      .select({ pref: humanUsers[prefCol] })
      .from(humanUsers)
      .where(eq(humanUsers.nullifierHash, recipientHash))
      .limit(1)
    if (user && user.pref === false) return
  }

  await db.insert(notifications).values({
    recipientHash,
    type,
    referenceId: referenceId ?? null,
    actorHash: actorHash ?? null,
  })
}

export async function getNotifications(
  recipientHash: string,
  limit = 30
): Promise<Notification[]> {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientHash, recipientHash))
    .orderBy(desc(notifications.createdAt))
    .limit(Math.min(limit, 50))
  return rows.map(toNotification)
}

export async function getUnreadCount(recipientHash: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<string>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.recipientHash, recipientHash), eq(notifications.read, false)))
  return parseInt(row?.count ?? '0', 10)
}

export async function markAllRead(recipientHash: string): Promise<void> {
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.recipientHash, recipientHash), eq(notifications.read, false)))
}
