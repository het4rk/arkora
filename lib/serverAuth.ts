import { createHash } from 'crypto'
import { cookies } from 'next/headers'

/**
 * Reads the caller's nullifier hash from the server-side `arkora-nh` httpOnly cookie.
 * This cookie is set by both auth flows (wallet sign-in + World ID Orb verify).
 * Use this to identify the authenticated caller on protected endpoints instead of
 * trusting a hash sent in the request body/query.
 */
export async function getCallerNullifier(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('arkora-nh')?.value ?? null
}

/**
 * Derives the stable wallet-based nullifier from a wallet address.
 * Prefixed `wlt_` to distinguish from World ID Orb nullifiers.
 */
export function walletToNullifier(walletAddress: string): string {
  const hash = createHash('sha256')
    .update(walletAddress.toLowerCase())
    .digest('hex')
  return `wlt_${hash}`
}
