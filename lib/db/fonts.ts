import { db } from '@/lib/db'
import { fontPurchases, humanUsers } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'

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

/** Query owned fonts across all linked nullifiers (handles split wlt_/0x identities). */
export async function getOwnedFontsByNullifiers(nullifiers: string[]): Promise<string[]> {
  if (nullifiers.length === 0) return []
  if (nullifiers.length === 1) return getOwnedFonts(nullifiers[0]!)
  const rows = await db
    .select({ fontId: fontPurchases.fontId })
    .from(fontPurchases)
    .where(inArray(fontPurchases.buyerHash, nullifiers))
  return [...new Set(rows.map((r) => r.fontId))]
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

/** Get active font checking all linked identities - picks first non-default. */
export async function getActiveFontForNullifiers(
  nullifiers: string[]
): Promise<{ fontId: string }> {
  if (nullifiers.length === 0) return { fontId: 'system' }
  if (nullifiers.length === 1) return getActiveFont(nullifiers[0]!)
  const rows = await db
    .select({ fontId: humanUsers.activeFontId })
    .from(humanUsers)
    .where(inArray(humanUsers.nullifierHash, nullifiers))
  const nonDefault = rows.find((r) => r.fontId && r.fontId !== 'system')
  return { fontId: nonDefault?.fontId ?? rows[0]?.fontId ?? 'system' }
}
