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
 * Used for MiniKit (in-app) proofs which use v3 format.
 * This is an eth_call (view function) - no gas, no transaction, no user signing.
 *
 * If the contract doesn't revert, the proof is valid.
 */
export async function verifyWorldIdProof(
  proof: ISuccessResult,
  action: string,
  signal?: string
): Promise<VerifyResult> {
  // Always use NEXT_PUBLIC_APP_ID - this is the same var that IDKit uses client-side
  // to generate the ZK proof's externalNullifierHash. Using any other var causes mismatch.
  const appId = (process.env.NEXT_PUBLIC_APP_ID) as `app_${string}`
  const routerAddress = (process.env.WORLD_ID_ROUTER ??
    '0x17B354dD2595411ff79041f930e491A4Df39A278') as Hex

  if (!appId) {
    console.error('[worldid] FATAL: NEXT_PUBLIC_APP_ID env var not set!')
    return { success: false, error: 'Server misconfiguration: NEXT_PUBLIC_APP_ID not set' }
  }

  const externalNullifierHash = computeExternalNullifierHash(appId, action)

  const root = BigInt(proof.merkle_root)
  const nullifierHash = BigInt(proof.nullifier_hash)
  const signalHash = hashToField(encodePacked(['string'], [signal ?? '']))

  const [decodedProof] = decodeAbiParameters(
    [{ type: 'uint256[8]' }],
    proof.proof as Hex
  )

  // Retry on NonExistentRoot - the root may not have propagated to our RPC yet.
  // World App generates the proof against the latest tree; a few seconds' lag is common.
  const MAX_ATTEMPTS = 3

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await getClient().readContract({
        address: routerAddress,
        abi: WORLD_ID_ABI,
        functionName: 'verifyProof',
        args: [root, 1n, signalHash, nullifierHash, externalNullifierHash, decodedProof],
      })
      return { success: true, nullifierHash: proof.nullifier_hash }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const contractError = identifyContractError(message)

      // Retry only on NonExistentRoot (root propagation lag). All other errors are deterministic.
      if (contractError === 'NonExistentRoot' || contractError === 'InvalidRoot') {
        if (attempt < MAX_ATTEMPTS) {
          await new Promise<void>((r) => setTimeout(r, 1000))
          continue
        }
        // All retries exhausted - root genuinely not found
        return { success: false, error: 'expired_root' }
      }

      // Nullifier already used on-chain
      if (contractError === 'InvalidNullifier') {
        return { success: false, error: 'max_verifications_reached' }
      }

      // Root expired (not just non-existent - no point retrying)
      if (contractError === 'ExpiredRoot') {
        return { success: false, error: 'expired_root' }
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

  // Unreachable - all code paths inside the loop return. TypeScript needs this.
  return { success: false, error: 'expired_root' }
}

/**
 * Verifies a World ID proof via the v4 cloud API.
 * Used for IDKit (desktop/mobile-browser) proofs.
 * Accepts both v3 (legacy) and v4 proof formats.
 *
 * POST https://developer.world.org/api/v4/verify/{rp_id}
 * Body: the raw IDKit result (forwarded directly)
 */
export async function verifyWorldIdProofCloud(
  idkitResult: Record<string, unknown>
): Promise<VerifyResult> {
  const rpId = process.env.IDKIT_RP_ID ?? process.env.NEXT_PUBLIC_RP_ID
  if (!rpId) {
    console.error('[worldid] FATAL: IDKIT_RP_ID env var not set!')
    return { success: false, error: 'Server misconfiguration: IDKIT_RP_ID not set' }
  }

  try {
    const res = await fetch(`https://developer.world.org/api/v4/verify/${rpId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(idkitResult),
      signal: AbortSignal.timeout(15000),
    })

    const json = await res.json() as {
      success: boolean
      nullifier?: string
      action?: string
      code?: string
      detail?: string
      results?: Array<{ identifier: string; success: boolean; nullifier?: string; code?: string; detail?: string }>
    }

    if (!res.ok || !json.success) {
      const detail = json.detail ?? json.results?.[0]?.detail ?? 'Verification failed'
      const code = json.code ?? json.results?.[0]?.code ?? 'unknown'
      console.error('[worldid] Cloud verify failed:', code, detail)

      if (code === 'all_verifications_failed' && detail.toLowerCase().includes('already')) {
        return { success: false, error: 'max_verifications_reached' }
      }
      return { success: false, error: detail }
    }

    // Extract nullifier from response - check top-level first, then per-credential results
    const nullifier = json.nullifier ?? json.results?.[0]?.nullifier
    if (!nullifier) {
      console.error('[worldid] Cloud verify succeeded but no nullifier returned')
      return { success: false, error: 'No nullifier in verification response' }
    }

    return { success: true, nullifierHash: nullifier }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[worldid] Cloud verify error:', message)
    if (message.includes('timeout') || message.includes('abort')) {
      return { success: false, error: 'network_error' }
    }
    return { success: false, error: 'network_error' }
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
