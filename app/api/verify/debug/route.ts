import { NextResponse } from 'next/server'
import { createPublicClient, http, type Hex } from 'viem'
import { worldchain } from 'viem/chains'

/**
 * GET /api/verify/debug
 * Diagnostic endpoint - tests env vars, RPC connectivity, and contract access.
 * Hit this in your browser to see exactly what the server sees.
 */
export async function GET() {
  const appId = process.env.APP_ID ?? process.env.NEXT_PUBLIC_APP_ID
  const actionId = process.env.NEXT_PUBLIC_ACTION_ID
  const rpc = process.env.WORLD_CHAIN_RPC ?? 'https://worldchain-mainnet.g.alchemy.com/public'
  const routerAddress = (process.env.WORLD_ID_ROUTER ?? '0x17B354dD2595411ff79041f930e491A4Df39A278') as Hex

  const checks: Record<string, unknown> = {
    env: {
      APP_ID: appId ? `${appId.slice(0, 8)}...${appId.slice(-4)}` : 'NOT SET',
      NEXT_PUBLIC_APP_ID: process.env.NEXT_PUBLIC_APP_ID ? 'set' : 'NOT SET',
      NEXT_PUBLIC_ACTION_ID: actionId ?? 'NOT SET (defaults to verifyhuman)',
      WORLD_CHAIN_RPC: process.env.WORLD_CHAIN_RPC ? 'custom' : 'public alchemy (default)',
      WORLD_ID_ROUTER: process.env.WORLD_ID_ROUTER ?? 'default (0x17B3...)',
    },
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
