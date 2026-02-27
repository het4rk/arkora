import { db } from '@/lib/db'
import { skinPurchases, humanUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function recordSkinPurchase(
  buyerHash: string,
  skinId: string,
  amountWld: string,
  txId: string | null
): Promise<void> {
  await db
    .insert(skinPurchases)
    .values({ buyerHash, skinId, amountWld, txId })
    .onConflictDoNothing()
}

export async function getOwnedSkins(buyerHash: string): Promise<string[]> {
  const rows = await db
    .select({ skinId: skinPurchases.skinId })
    .from(skinPurchases)
    .where(eq(skinPurchases.buyerHash, buyerHash))
  return rows.map((r) => r.skinId)
}

export async function setActiveSkin(
  nullifierHash: string,
  skinId: string,
  customHex?: string | null
): Promise<void> {
  await db
    .update(humanUsers)
    .set({ activeSkinId: skinId, customHex: customHex ?? null })
    .where(eq(humanUsers.nullifierHash, nullifierHash))
}

export async function getActiveSkin(
  nullifierHash: string
): Promise<{ skinId: string; customHex: string | null }> {
  const [row] = await db
    .select({
      skinId: humanUsers.activeSkinId,
      customHex: humanUsers.customHex,
    })
    .from(humanUsers)
    .where(eq(humanUsers.nullifierHash, nullifierHash))
    .limit(1)
  return {
    skinId: row?.skinId ?? 'monochrome',
    customHex: row?.customHex ?? null,
  }
}
