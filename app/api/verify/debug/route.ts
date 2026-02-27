import { NextResponse } from 'next/server'
import { createPublicClient, http, keccak256, encodePacked, type Hex } from 'viem'
import { worldchain } from 'viem/chains'

function hashToField(hex: Hex): bigint {
  return BigInt(keccak256(hex)) >> 8n
}

function computeExternalNullifierHash(appId: string, action: string): string {
  const appIdHash = hashToField(encodePacked(['string'], [appId]))
  const enh = hashToField(encodePacked(['uint256', 'string'], [appIdHash, action]))
  return '0x' + enh.toString(16).padStart(64, '0')
}

/**
 * GET /api/verify/debug
 * Diagnostic endpoint - tests env vars, RPC connectivity, and contract access.
 * Hit this in your browser to see exactly what the server sees.
 */
export async function GET() {
  // Use only NEXT_PUBLIC_APP_ID (same var as IDKit client) to ensure matching externalNullifierHash
  const appId = process.env.NEXT_PUBLIC_APP_ID
  const actionId = process.env.NEXT_PUBLIC_ACTION_ID ?? 'verifyhuman'
  const rpc = process.env.WORLD_CHAIN_RPC ?? 'https://worldchain-mainnet.g.alchemy.com/public'
  const routerAddress = (process.env.WORLD_ID_ROUTER ?? '0x17B354dD2595411ff79041f930e491A4Df39A278') as Hex

  const externalNullifierHash = appId
    ? computeExternalNullifierHash(appId, actionId)
    : 'CANNOT COMPUTE — NEXT_PUBLIC_APP_ID not set'

  const checks: Record<string, unknown> = {
    env: {
      NEXT_PUBLIC_APP_ID: appId ? `${appId.slice(0, 8)}...${appId.slice(-4)}` : 'NOT SET',
      NEXT_PUBLIC_ACTION_ID: actionId,
      WORLD_CHAIN_RPC: process.env.WORLD_CHAIN_RPC ? 'custom' : 'public alchemy (default)',
      WORLD_ID_ROUTER: process.env.WORLD_ID_ROUTER ?? 'default (0x17B3...)',
    },
    externalNullifierHash,
  }

  // Test RPC connectivity
  try {
    const client = createPublicClient({ chain: worldchain, transport: http(rpc) })
    const blockNumber = await client.getBlockNumber()
    checks.rpc = { status: 'OK', blockNumber: Number(blockNumber), endpoint: rpc.includes('alchemy') ? 'alchemy-public' : 'custom' }

    // Test contract exists
    const code = await client.getCode({ address: routerAddress })
    checks.contract = { status: code && code.length > 2 ? 'OK' : 'NO CODE', codeLength: code?.length ?? 0, address: routerAddress }
  } catch (err) {
    checks.rpc = { status: 'FAILED', error: err instanceof Error ? err.message.slice(0, 200) : String(err) }
  }

  return NextResponse.json(checks, { status: 200 })
}
