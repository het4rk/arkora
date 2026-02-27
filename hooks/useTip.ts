'use client'

import { MiniKit, Tokens, Network } from '@worldcoin/minikit-js'
import { parseEther } from 'viem'

/**
 * Sends a WLD payment via MiniKit.pay() — the official World 4.0 payment flow.
 * Uses reference tracking for Developer Portal integration.
 * Returns { txId, reference } on success, null on failure/cancel.
 */
export async function sendWld(
  toWallet: string,
  amountWld: number,
  description: string = 'Arkora payment'
): Promise<{ txId: string; reference: string } | null> {
  if (!MiniKit.isInstalled()) return null

  try {
    const reference = `arkora_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const tokenAmount = parseEther(amountWld.toString()).toString()

    const { finalPayload } = await MiniKit.commandsAsync.pay({
      reference,
      to: toWallet as `0x${string}`,
      tokens: [{ symbol: Tokens.WLD, token_amount: tokenAmount }],
      network: Network.WorldChain,
      description,
    })

    if (finalPayload.status === 'error') return null

    const success = finalPayload as {
      transaction_id?: string
      reference?: string
    }

    return {
      txId: success.transaction_id ?? '',
      reference: success.reference ?? reference,
    }
  } catch {
    return null
  }
}
