import {
  createPublicClient,
  http,
  decodeAbiParameters,
  keccak256,
  encodePacked,
  type Hex,
} from 'viem'
import { worldchain } from 'viem/chains'
import type { ISuccessResult } from '@worldcoin/minikit-js'

const WORLD_ID_ABI = [
  {
    name: 'verifyProof',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'root', type: 'uint256' },
      { name: 'groupId', type: 'uint256' },
      { name: 'signalHash', type: 'uint256' },
      { name: 'nullifierHash', type: 'uint256' },
      { name: 'externalNullifierHash', type: 'uint256' },
      { name: 'proof', type: 'uint256[8]' },
    ],
    outputs: [],
  },
] as const

/**
 * hashToField mirrors the ByteHasher.hashToField() function in Worldcoin's
 * Solidity contracts: keccak256(abi.encodePacked(value)) >> 8.
 * Shifting right by 8 bits ensures the result fits in the BN254 scalar field.
 */
function hashToField(hex: Hex): bigint {
  return BigInt(keccak256(hex)) >> 8n
}

/**
 * Computes the external nullifier hash from app_id + action,
 * matching the computation done by IDKit/MiniKit when creating the ZK proof.
 *
 * externalNullifierHash = hashToField(abi.encodePacked(
 *   hashToField(abi.encodePacked(app_id)),  // uint256
 *   action                                  // string
 * ))
 */
function computeExternalNullifierHash(appId: string, action: string): bigint {
  const appIdHash = hashToField(encodePacked(['string'], [appId]))
  return hashToField(encodePacked(['uint256', 'string'], [appIdHash, action]))
}

function getClient() {
  const rpc = process.env.WORLD_CHAIN_RPC ?? 'https://worldchain-mainnet.g.alchemy.com/public'
  return createPublicClient({ chain: worldchain, transport: http(rpc) })
}

/**
 * Verifies a World ID proof against the WorldIDRouter contract on World Chain.
 * This is an eth_call (view function) — no gas, no transaction, no user signing.
 *
 * If the contract doesn't revert, the proof is valid.
 */
export async function verifyWorldIdProof(
  proof: ISuccessResult,
  action: string,
  signal?: string
): Promise<{ success: boolean; nullifierHash?: string; error?: string }> {
  const appId = process.env.APP_ID as `app_${string}`
  const routerAddress = (process.env.WORLD_ID_ROUTER ??
    '0x17B354dD2595411ff79041f930e491A4Df39A278') as Hex

  try {
    const root = BigInt(proof.merkle_root)
    const nullifierHash = BigInt(proof.nullifier_hash)
    const externalNullifierHash = computeExternalNullifierHash(appId, action)
    const signalHash = hashToField(encodePacked(['string'], [signal ?? '']))

    const [decodedProof] = decodeAbiParameters(
      [{ type: 'uint256[8]' }],
      proof.proof as Hex
    )

    await getClient().readContract({
      address: routerAddress,
      abi: WORLD_ID_ABI,
      functionName: 'verifyProof',
      // groupId 1 = Orb-level verification
      args: [root, 1n, signalHash, nullifierHash, externalNullifierHash, decodedProof],
    })

    return { success: true, nullifierHash: proof.nullifier_hash }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    // InvalidNullifier() revert = nullifier was already used (duplicate verify attempt)
    if (
      message.includes('InvalidNullifier') ||
      message.toLowerCase().includes('already') ||
      message.toLowerCase().includes('max_verifications')
    ) {
      return { success: false, error: 'max_verifications_reached' }
    }

    return { success: false, error: message }
  }
}

/**
 * Returns the current block number on World Chain.
 * Used to record verifiedBlockNumber at the time of proof validation.
 */
export async function getLatestWorldChainBlock(): Promise<bigint> {
  try {
    return await getClient().getBlockNumber()
  } catch {
    return 0n
  }
}
