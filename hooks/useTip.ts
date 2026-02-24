'use client'

import { MiniKit } from '@worldcoin/minikit-js'
import { parseEther } from 'viem'
import { WLD_TOKEN_ADDRESS, ERC20_TRANSFER_ABI } from '@/lib/contracts'

/**
 * Sends a WLD ERC-20 transfer onchain via MiniKit sendTransaction.
 * Returns the MiniKit transaction ID on success, null on failure/cancel.
 */
export async function sendWld(toWallet: string, amountWld: number): Promise<string | null> {
  if (!MiniKit.isInstalled()) return null

  try {
    const amountWei = parseEther(amountWld.toString())
    const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
      transaction: [
        {
          address: WLD_TOKEN_ADDRESS,
          abi: ERC20_TRANSFER_ABI,
          functionName: 'transfer',
          args: [toWallet as `0x${string}`, amountWei],
        },
      ],
    })
    if (finalPayload.status === 'error') return null
    return (finalPayload as { transaction_id?: string }).transaction_id ?? null
  } catch {
    return null
  }
}
