import { db } from './index'
import { tips } from './schema'
import { eq, sum } from 'drizzle-orm'

export async function recordTip(
  senderHash: string,
  recipientHash: string,
  recipientWallet: string,
  amountWld: string,
  txId?: string
) {
  await db.insert(tips).values({ senderHash, recipientHash, recipientWallet, amountWld, txId: txId ?? null })
}

/** Returns total WLD received as a number (0 if none). */
export async function getTipTotalReceived(recipientHash: string): Promise<number> {
  const [row] = await db
    .select({ total: sum(tips.amountWld) })
    .from(tips)
    .where(eq(tips.recipientHash, recipientHash))
  const raw = row?.total
  return raw ? parseFloat(raw) : 0
}
