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

type VerifyResult = { success: boolean; nullifierHash?: string; error?: string }

// Error selectors from the World ID Router / Semaphore contracts.
// Viem needs these to decode custom revert reasons; without them it only shows hex.
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
  // Custom errors so viem can decode revert reasons
  { type: 'error', name: 'InvalidRoot', inputs: [] },
  { type: 'error', name: 'NonExistentRoot', inputs: [] },
  { type: 'error', name: 'ExpiredRoot', inputs: [] },
  { type: 'error', name: 'InvalidNullifier', inputs: [] },
  { type: 'error', name: 'InvalidProof', inputs: [] },
  { type: 'error', name: 'GroupDoesNotExist', inputs: [] },
  { type: 'error', name: 'MismatchedInputLengths', inputs: [] },
] as const

// Error selectors (keccak256 of signature, first 4 bytes) for fallback matching
// when viem can't decode (e.g., errors from delegated contracts not in our ABI)
const ERROR_SELECTORS: Record<string, string> = {
  '0x504570e3': 'InvalidRoot',
  '0xddae3b71': 'NonExistentRoot',
  '0x3ae7359e': 'ExpiredRoot',
  '0x5d904cb2': 'InvalidNullifier',
  '0x09bde339': 'InvalidProof',
  '0x69128538': 'GroupDoesNotExist',
}

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
 * Extracts the decoded error name from a contract revert.
 * Checks both viem-decoded names and raw hex selectors.
 */
function identifyContractError(message: string): string | null {
  // Check for viem-decoded error names
  for (const name of ['InvalidRoot', 'NonExistentRoot', 'ExpiredRoot', 'InvalidNullifier', 'InvalidProof', 'GroupDoesNotExist']) {
    if (message.includes(name)) return name
  }
  // Check for raw hex selectors (when viem can't decode)
  for (const [selector, name] of Object.entries(ERROR_SELECTORS)) {
    if (message.includes(selector)) return name
  }
  return null
}

/**
 * Verifies a World ID proof against the WorldIDRouter contract on World Chain.
 * This is an eth_call (view function) - no gas, no transaction, no user signing.
 *
 * If the contract doesn't revert, the proof is valid.
 */
export async function verifyWorldIdProof(
  proof: ISuccessResult,
  action: string,
  signal?: string
): Promise<VerifyResult> {
  const appId = (process.env.APP_ID ?? process.env.NEXT_PUBLIC_APP_ID) as `app_${string}`
  const routerAddress = (process.env.WORLD_ID_ROUTER ??
    '0x17B354dD2595411ff79041f930e491A4Df39A278') as Hex

  console.log('[worldid] Verifying proof on-chain, appId:', appId, 'action:', action)

  try {
    const root = BigInt(proof.merkle_root)
    const nullifierHash = BigInt(proof.nullifier_hash)
    const externalNullifierHash = computeExternalNullifierHash(appId, action)
    const signalHash = hashToField(encodePacked(['string'], [signal ?? '']))

    console.log('[worldid] root:', proof.merkle_root.slice(0, 18) + '...', 'nh:', proof.nullifier_hash.slice(0, 18) + '...')

    const [decodedProof] = decodeAbiParameters(
      [{ type: 'uint256[8]' }],
      proof.proof as Hex
    )

    await getClient().readContract({
      address: routerAddress,
      abi: WORLD_ID_ABI,
      functionName: 'verifyProof',
      args: [root, 1n, signalHash, nullifierHash, externalNullifierHash, decodedProof],
    })

    console.log('[worldid] Proof verified successfully!')
    return { success: true, nullifierHash: proof.nullifier_hash }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const contractError = identifyContractError(message)
    console.error('[worldid] FAILED:', contractError ?? message.slice(0, 500))

    // Root issues - user's proof references a Merkle root the contract doesn't recognize
    if (contractError === 'NonExistentRoot' || contractError === 'ExpiredRoot' || contractError === 'InvalidRoot') {
      return { success: false, error: 'expired_root' }
    }

    // Nullifier already used on-chain (user already verified for this action)
    if (contractError === 'InvalidNullifier') {
      return { success: false, error: 'max_verifications_reached' }
    }

    // ZK proof math didn't check out
    if (contractError === 'InvalidProof') {
      return { success: false, error: 'invalid_proof' }
    }

    // Network / RPC errors
    if (
      message.includes('fetch') ||
      message.includes('ECONNREFUSED') ||
      message.includes('timeout') ||
      message.includes('ETIMEDOUT') ||
      message.includes('503') ||
      message.includes('502') ||
      message.includes('429')
    ) {
      return { success: false, error: 'network_error' }
    }

    return { success: false, error: `on_chain_failed: ${contractError ?? message.slice(0, 200)}` }
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
