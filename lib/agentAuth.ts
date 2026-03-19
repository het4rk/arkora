import { NextRequest, NextResponse } from 'next/server'
import {
  parseAgentkitHeader,
  validateAgentkitMessage,
  verifyAgentkitSignature,
  createAgentBookVerifier,
  declareAgentkitExtension,
} from '@worldcoin/agentkit'
import { DrizzleAgentKitStorage } from '@/lib/db/agentkit'
import { requireApiKey, CORS_HEADERS } from '@/lib/apiKeyAuth'
import { buildPaymentRequired } from '@/lib/x402'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type V2AuthResult =
  | { ok: true; authType: 'agentkit'; humanId: string; key: string }
  | { ok: true; authType: 'apikey'; key: string }

// ---------------------------------------------------------------------------
// Singletons (module-level, reused across requests)
// ---------------------------------------------------------------------------

const storage = new DrizzleAgentKitStorage()

const agentBookOpts: Parameters<typeof createAgentBookVerifier>[0] = {
  network: 'world',
}
if (process.env.AGENTKIT_RPC_URL) {
  agentBookOpts.rpcUrl = process.env.AGENTKIT_RPC_URL
}
const agentBook = createAgentBookVerifier(agentBookOpts)

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

/** CORS headers for v2 endpoints - extends v1 with AgentKit + x402 headers. */
export const V2_CORS_HEADERS: Record<string, string> = {
  ...CORS_HEADERS,
  'Access-Control-Allow-Headers':
    'X-API-Key, Authorization, agentkit, x-agentkit, X-402-Payment',
}

// ---------------------------------------------------------------------------
// AgentKit extension declaration builder
// ---------------------------------------------------------------------------

function buildAgentkitExtension(req: NextRequest, freeTrial: number) {
  return declareAgentkitExtension({
    domain: req.nextUrl.hostname,
    resourceUri: req.nextUrl.pathname,
    statement: 'Arkora verified-human data API',
    mode: { type: 'free-trial', uses: freeTrial },
  })
}

// ---------------------------------------------------------------------------
// Core AgentKit verification (shared by dual + premium auth)
// ---------------------------------------------------------------------------

/**
 * Verifies an AgentKit header: validates the message, verifies the signature,
 * looks up the human ID from AgentBook, and checks nonce replay.
 *
 * Returns the verified humanId on success, or a NextResponse error.
 */
async function verifyAgentKit(
  header: string,
  req: NextRequest
): Promise<{ ok: true; humanId: string } | NextResponse> {
  try {
    const payload = parseAgentkitHeader(header)

    const validation = await validateAgentkitMessage(payload, req.nextUrl.pathname, {
      maxAge: 300, // 5 minutes
      checkNonce: async (nonce: string) => {
        const used = await storage.hasUsedNonce(nonce)
        if (used) return false
        await storage.recordNonce(nonce)
        return true
      },
    })

    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: `AgentKit validation failed: ${validation.error ?? 'unknown'}` },
        { status: 401, headers: V2_CORS_HEADERS }
      )
    }

    const verification = await verifyAgentkitSignature(
      payload,
      process.env.AGENTKIT_RPC_URL
    )

    if (!verification.valid || !verification.address) {
      return NextResponse.json(
        { success: false, error: `AgentKit signature invalid: ${verification.error ?? 'unknown'}` },
        { status: 401, headers: V2_CORS_HEADERS }
      )
    }

    const humanId = await agentBook.lookupHuman(verification.address, payload.chainId)

    if (!humanId) {
      return NextResponse.json(
        { success: false, error: 'Agent not registered in AgentBook. Owner must verify with World ID.' },
        { status: 403, headers: V2_CORS_HEADERS }
      )
    }

    return { ok: true, humanId }
  } catch (err) {
    return NextResponse.json(
      { success: false, error: `AgentKit error: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 401, headers: V2_CORS_HEADERS }
    )
  }
}

// ---------------------------------------------------------------------------
// Dual auth (base v2 endpoints: posts, polls, boards, stats)
// ---------------------------------------------------------------------------

/**
 * Dual auth middleware for v2 routes.
 * Tries AgentKit header first, falls back to API key.
 * Returns 402 with AgentKit extension declaration if neither is present.
 */
export async function requireV2Auth(
  req: NextRequest
): Promise<V2AuthResult | NextResponse> {
  const agentkitHeader =
    req.headers.get('agentkit') ?? req.headers.get('x-agentkit')

  if (agentkitHeader) {
    const result = await verifyAgentKit(agentkitHeader, req)
    if (result instanceof NextResponse) return result
    return { ok: true, authType: 'agentkit', humanId: result.humanId, key: result.humanId }
  }

  // Fall back to API key auth
  const apiKeyHeader =
    req.headers.get('x-api-key') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  if (apiKeyHeader) {
    const auth = await requireApiKey(req)
    if (auth instanceof NextResponse) return auth
    return { ok: true, authType: 'apikey', key: auth.key }
  }

  // Neither present - return 402 with AgentKit extension info
  return NextResponse.json(
    {
      success: false,
      error: 'Authentication required. Use AgentKit (proof of human) or API key.',
      extensions: buildAgentkitExtension(req, 50),
    },
    { status: 402, headers: V2_CORS_HEADERS }
  )
}

// ---------------------------------------------------------------------------
// Premium auth (sentiment, trends, demographics - AgentKit-only)
// ---------------------------------------------------------------------------

/** Free-trial daily request limit for premium endpoints. */
const FREE_TRIAL_DAILY = 50

export interface PremiumAuthResult {
  ok: true
  humanId: string
  key: string
}

/**
 * AgentKit-only auth for premium endpoints.
 * Rejects API key fallback.
 * Enforces free-trial daily quota. When exhausted, returns 402 with both:
 *   - x402 payment instructions (how to pay USDC on World Chain)
 *   - AgentKit extension declaration (for new agents to discover auth method)
 *
 * @param endpointKey - e.g. "v2/sentiment" - used for usage tracking and x402 pricing
 */
export async function requirePremiumAuth(
  req: NextRequest,
  endpointKey: string
): Promise<PremiumAuthResult | NextResponse> {
  const agentkitHeader =
    req.headers.get('agentkit') ?? req.headers.get('x-agentkit')

  if (!agentkitHeader) {
    // No AgentKit header - return 402 with discovery info
    const paymentRequired = buildPaymentRequired(endpointKey, req.nextUrl.toString())

    return NextResponse.json(
      {
        success: false,
        error: 'This endpoint requires AgentKit authentication (proof of human).',
        extensions: buildAgentkitExtension(req, FREE_TRIAL_DAILY),
        ...(paymentRequired ? { paymentRequired } : {}),
      },
      { status: 402, headers: V2_CORS_HEADERS }
    )
  }

  // Verify AgentKit credentials
  const result = await verifyAgentKit(agentkitHeader, req)
  if (result instanceof NextResponse) return result

  const { humanId } = result

  // Check free-trial daily quota
  const dailyUsage = await storage.getUsageCount(endpointKey, humanId)

  if (dailyUsage >= FREE_TRIAL_DAILY) {
    // Quota exhausted - return 402 with x402 payment instructions
    const paymentRequired = buildPaymentRequired(endpointKey, req.nextUrl.toString())

    return NextResponse.json(
      {
        success: false,
        error: `Free trial exhausted (${FREE_TRIAL_DAILY}/day). Pay per request to continue.`,
        dailyUsage,
        dailyLimit: FREE_TRIAL_DAILY,
        extensions: buildAgentkitExtension(req, FREE_TRIAL_DAILY),
        ...(paymentRequired ? { paymentRequired } : {}),
      },
      { status: 402, headers: V2_CORS_HEADERS }
    )
  }

  // Within free trial - increment usage and grant access
  await storage.incrementUsage(endpointKey, humanId)

  return { ok: true, humanId, key: humanId }
}
