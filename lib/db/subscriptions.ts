import { db } from './index'
import { subscriptions } from './schema'
import { and, eq, gt, isNull, or, count, sql } from 'drizzle-orm'

function thirtyDaysFromNow(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d
}

function isActiveCondition() {
  return and(
    eq(subscriptions.isActive, true),
    gt(subscriptions.expiresAt, sql`now()`),
    isNull(subscriptions.cancelledAt)
  )
}

export async function upsertSubscription(
  subscriberHash: string,
  creatorHash: string,
  creatorWallet: string,
  amountWld: string,
  txId?: string
) {
  const expiresAt = thirtyDaysFromNow()
  await db
    .insert(subscriptions)
    .values({
      subscriberHash,
      creatorHash,
      creatorWallet,
      amountWld,
      txId: txId ?? null,
      expiresAt,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [subscriptions.subscriberHash, subscriptions.creatorHash],
      set: {
        isActive: true,
        cancelledAt: null,
        expiresAt,
        txId: txId ?? subscriptions.txId,
        amountWld,
      },
    })
  return getSubscription(subscriberHash, creatorHash)
}

export async function getSubscription(subscriberHash: string, creatorHash: string) {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.subscriberHash, subscriberHash),
        eq(subscriptions.creatorHash, creatorHash)
      )
    )
  return row ?? null
}

export async function getActiveSubscription(subscriberHash: string, creatorHash: string) {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.subscriberHash, subscriberHash),
        eq(subscriptions.creatorHash, creatorHash),
        ...([isActiveCondition()].flat())
      )
    )
  return row ?? null
}

export async function cancelSubscription(subscriberHash: string, creatorHash: string) {
  await db
    .update(subscriptions)
    .set({ cancelledAt: new Date(), isActive: false })
    .where(
      and(
        eq(subscriptions.subscriberHash, subscriberHash),
        eq(subscriptions.creatorHash, creatorHash)
      )
    )
}

/** All active (non-expired, non-cancelled) subscriptions the user is paying for. */
export async function getActiveSubscriptions(subscriberHash: string) {
  return db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.subscriberHash, subscriberHash),
        eq(subscriptions.isActive, true),
        gt(subscriptions.expiresAt, sql`now()`),
        isNull(subscriptions.cancelledAt)
      )
    )
    .orderBy(subscriptions.expiresAt)
}

/** Count of users currently subscribed to a creator. */
export async function getSubscriberCount(creatorHash: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.creatorHash, creatorHash),
        eq(subscriptions.isActive, true),
        gt(subscriptions.expiresAt, sql`now()`),
        isNull(subscriptions.cancelledAt)
      )
    )
  return row?.n ?? 0
}
