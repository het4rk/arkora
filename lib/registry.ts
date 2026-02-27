/**
 * ArkoraNullifierRegistry - server-side integration.
 *
 * After a successful World ID proof verification, the server calls register()
 * on the deployed ArkoraNullifierRegistry contract. This creates an immutable
 * onchain record: "this nullifier was verified by Arkora at block N".
 *
 * This is fire-and-forget - a registration failure never blocks the verify flow.
 * The tx hash is stored in humanUsers.registrationTxHash if successful.
 *
 * Required env vars (set in Vercel Dashboard after deploying the contract):
 *   REGISTRY_ADDRESS            - deployed ArkoraNullifierRegistry address
 *   REGISTRY_DEPLOYER_PRIVATE_KEY - the wallet that owns the contract (for signing)
 *   WORLD_CHAIN_RPC             - already required for WorldID verification
 */

import { createWalletClient, createPublicClient, http, type Hex, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { worldchain } from 'viem/chains'

const REGISTRY_ABI = [
  {
    name: 'register',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'nullifierHash', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'lookup',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'nullifierHash', type: 'bytes32' }],
    outputs: [
      { name: 'registered', type: 'bool' },
      { name: 'blockNum', type: 'uint256' },
    ],
  },
] as const

/**
 * Converts a decimal nullifier hash string (from World ID proof) to bytes32.
 * World ID nullifier hashes are uint256 values returned as decimal strings.
 */
function nullifierToBytes32(nullifierHash: string): Hex {
  const bigintVal = BigInt(nullifierHash)
  const hex = bigintVal.toString(16).padStart(64, '0')
  return `0x${hex}`
}

function getClients() {
  const privateKey = process.env.REGISTRY_DEPLOYER_PRIVATE_KEY as Hex | undefined
  const registryAddress = process.env.REGISTRY_ADDRESS as Address | undefined
  const rpc = process.env.WORLD_CHAIN_RPC ?? 'https://worldchain-mainnet.g.alchemy.com/public'

  if (!privateKey || !registryAddress) return null

  const account = privateKeyToAccount(privateKey)
  const walletClient = createWalletClient({
    account,
    chain: worldchain,
    transport: http(rpc),
  })
  const publicClient = createPublicClient({
    chain: worldchain,
    transport: http(rpc),
  })

  return { walletClient, publicClient, account, registryAddress }
}

/**
 * Registers a verified nullifier in the onchain registry.
 * Returns the transaction hash if successful, null if the registry is not
 * configured or if the nullifier is already registered.
 *
 * Never throws - safe to call fire-and-forget from the verify route.
 */
export async function registerNullifierOnchain(nullifierHash: string): Promise<string | null> {
  const clients = getClients()
  if (!clients) return null // registry not configured yet - silent skip

  const { walletClient, publicClient, account, registryAddress } = clients

  try {
    // Check if already registered (avoid wasting gas on a revert)
    const [alreadyRegistered] = await publicClient.readContract({
      address: registryAddress,
      abi: REGISTRY_ABI,
      functionName: 'lookup',
      args: [nullifierToBytes32(nullifierHash)],
    })
    if (alreadyRegistered) return null

    const txHash = await walletClient.writeContract({
      address: registryAddress,
      abi: REGISTRY_ABI,
      functionName: 'register',
      args: [nullifierToBytes32(nullifierHash)],
      account,
    })

    // Wait for 1 confirmation
    await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 })
    return txHash
  } catch (err) {
    // Fire-and-forget: log but never surface to the user
    console.error('[registry] registration failed:', err instanceof Error ? err.message : String(err))
    return null
  }
}
