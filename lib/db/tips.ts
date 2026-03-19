import { db } from './index'
import { tips } from './schema'
import { eq, sum } from 'drizzle-orm'

/** Records a tip. Returns false if txId was already used (duplicate). */
export async function recordTip(
  senderHash: string,
  recipientHash: string,
  recipientWallet: string,
  amountWld: string,
  txId: string
): Promise<boolean> {
  try {
    await db.insert(tips).values({ senderHash, recipientHash, recipientWallet, amountWld, txId })
    return true
  } catch (err: unknown) {
    const pgErr = err as { code?: string }
    if (pgErr.code === '23505') {
      return false
    }
    throw err
  }
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
