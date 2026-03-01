import { db } from '@/lib/db'
import { fontPurchases, humanUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function recordFontPurchase(
  buyerHash: string,
  fontId: string,
  amountWld: string,
  txId: string | null
): Promise<void> {
  await db
    .insert(fontPurchases)
    .values({ buyerHash, fontId, amountWld, txId })
    .onConflictDoNothing()
}

export async function getOwnedFonts(buyerHash: string): Promise<string[]> {
  const rows = await db
    .select({ fontId: fontPurchases.fontId })
    .from(fontPurchases)
    .where(eq(fontPurchases.buyerHash, buyerHash))
  return rows.map((r) => r.fontId)
}

export async function setActiveFont(
  nullifierHash: string,
  fontId: string
): Promise<void> {
  await db
    .update(humanUsers)
    .set({ activeFontId: fontId })
    .where(eq(humanUsers.nullifierHash, nullifierHash))
}

export async function getActiveFont(
  nullifierHash: string
): Promise<{ fontId: string }> {
  const [row] = await db
    .select({ fontId: humanUsers.activeFontId })
    .from(humanUsers)
    .where(eq(humanUsers.nullifierHash, nullifierHash))
    .limit(1)
  return { fontId: row?.fontId ?? 'system' }
}
