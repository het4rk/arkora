import { createPublicClient, http, parseAbiItem, type Hex } from 'viem'
import { worldchain } from 'viem/chains'
import { WLD_TOKEN_ADDRESS } from '@/lib/contracts'

const client = createPublicClient({
  chain: worldchain,
  transport: http(process.env.WORLD_CHAIN_RPC ?? 'https://worldchain-mainnet.g.alchemy.com/public'),
})

const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
)

interface VerifyResult {
  verified: boolean
  from?: string
  to?: string
  amount?: bigint
  blockNumber?: bigint
  error?: string
}

/**
 * Verifies a WLD transfer transaction on World Chain.
 * Checks that the tx exists, succeeded, and contains a Transfer event
 * to the expected recipient for at least the expected amount.
 *
 * txId from MiniKit is NOT a tx hash - it's an internal ID.
 * We can't directly look up by MiniKit txId on-chain.
 * Instead, we trust the MiniKit pay() flow (which shows the user
 * the exact amount/recipient in World App before signing) and
 * record the txId for audit trail.
 *
 * For full on-chain verification, we'd need to:
 * 1. Wait for MiniKit to expose the actual tx hash
 * 2. Or poll the recipient's Transfer events for matching amounts
 *
 * This function attempts verification when a real tx hash is available.
 */
export async function verifyWldTransfer(
  txHash: string,
  expectedTo?: string,
  expectedAmountWei?: bigint
): Promise<VerifyResult> {
  // MiniKit transaction_id is NOT always a valid tx hash
  // If it doesn't look like a hex hash, skip verification
  if (!txHash.startsWith('0x') || txHash.length !== 66) {
    return { verified: false, error: 'Not a valid transaction hash - MiniKit reference ID' }
  }

  try {
    const receipt = await client.getTransactionReceipt({ hash: txHash as Hex })

    if (receipt.status !== 'success') {
      return { verified: false, error: 'Transaction reverted' }
    }

    // Parse Transfer events from the WLD token contract
    const transferLogs = receipt.logs.filter(
      (log) =>
        log.address.toLowerCase() === WLD_TOKEN_ADDRESS.toLowerCase() &&
        log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' // Transfer topic
    )

    if (transferLogs.length === 0) {
      return { verified: false, error: 'No WLD transfer found in transaction' }
    }

    // Check for a matching transfer
    for (const log of transferLogs) {
      const to = `0x${log.topics[2]?.slice(26)}`.toLowerCase()
      const value = BigInt(log.data)

      if (expectedTo && to !== expectedTo.toLowerCase()) continue
      if (expectedAmountWei && value < expectedAmountWei) continue

      return {
        verified: true,
        from: `0x${log.topics[1]?.slice(26)}`,
        to,
        amount: value,
        blockNumber: receipt.blockNumber,
      }
    }

    return { verified: false, error: 'Transfer does not match expected recipient or amount' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[verifyWldTransfer]', msg)
    return { verified: false, error: 'Failed to verify transaction on-chain' }
  }
}
