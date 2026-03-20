import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createDecipheriv } from 'crypto'
import { rateLimit } from '@/lib/rateLimit'
import { signRequest } from '@worldcoin/idkit/signing'
// verifyWorldIdProof imported dynamically below
import { getOrCreateUser, getUserByNullifier } from '@/lib/db/users'
import { createApiKey, countActiveKeysByOwner } from '@/lib/db/apiKeys'

// ── WASM fetch patch ──────────────────────────────────────────────────

const originalFetch = globalThis.fetch
function findWasmPath(): string {
  const candidates = [
    resolve(process.cwd(), 'node_modules/.pnpm/@worldcoin+idkit-core@4.0.15/node_modules/@worldcoin/idkit-core/dist/idkit_wasm_bg.wasm'),
    resolve(process.cwd(), 'node_modules/.pnpm/@worldcoin+idkit-core@4.0.13/node_modules/@worldcoin/idkit-core/dist/idkit_wasm_bg.wasm'),
  ]
  for (const p of candidates) {
    try { readFileSync(p, { flag: 'r' }); return p } catch { /* next */ }
  }
  throw new Error('Could not find idkit_wasm_bg.wasm')
}

let wasmPathCache: string | null = null
const patchedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request)?.url
  if (url?.endsWith('.wasm')) {
    if (!wasmPathCache) wasmPathCache = findWasmPath()
    return new Response(readFileSync(wasmPathCache), { headers: { 'Content-Type': 'application/wasm' } })
  }
  return originalFetch(input, init)
}) as typeof fetch

// ── Session store on globalThis (survives Next.js hot-reloads) ────────
type SessionEntry = { key: Buffer; requestId: string; createdAt: number }
const SESSION_TTL = 5 * 60_000
const g = globalThis as unknown as { __cliBridgeSessions?: Map<string, SessionEntry> }
if (!g.__cliBridgeSessions) g.__cliBridgeSessions = new Map()
const sessions = g.__cliBridgeSessions

function pruneExpiredSessions() {
  const cutoff = Date.now() - SESSION_TTL
  for (const [id, s] of sessions) {
    if (s.createdAt < cutoff) sessions.delete(id)
  }
}

// ── AES-256-GCM decryption ────────────────────────────────────────────

function decryptBridgeResponse(key: Buffer, ivB64: string, payloadB64: string): string {
  const iv = Buffer.from(ivB64, 'base64')
  const encrypted = Buffer.from(payloadB64, 'base64')
  // AES-GCM: last 16 bytes are auth tag
  const authTag = encrypted.subarray(encrypted.length - 16)
  const ciphertext = encrypted.subarray(0, encrypted.length - 16)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8')
}

// ── POST /api/cli/bridge ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'anon'
    if (!rateLimit(`cli-bridge:${ip}`, 5, 600_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests.' }, { status: 429 })
    }

    pruneExpiredSessions()

    const rpId = process.env.IDKIT_RP_ID
    const signingKey = process.env.IDKIT_SIGNING_KEY
    const appId = process.env.NEXT_PUBLIC_APP_ID
    const actionId = process.env.NEXT_PUBLIC_ACTION_ID

    if (!rpId || !signingKey || !appId || !actionId) {
      return NextResponse.json({ success: false, error: 'World ID not configured' }, { status: 500 })
    }

    const rpSig = signRequest(actionId, signingKey, 300)

    globalThis.fetch = patchedFetch
    const { IDKit, orbLegacy } = await import('@worldcoin/idkit')

    const builder = IDKit.request({
      app_id: appId as `app_${string}`,
      action: actionId,
      rp_context: {
        rp_id: rpId,
        nonce: rpSig.nonce,
        created_at: rpSig.createdAt,
        expires_at: rpSig.expiresAt,
        signature: rpSig.sig,
      },
      allow_legacy_proofs: true,
    })

    const request = await builder.preset(orbLegacy())
    globalThis.fetch = originalFetch

    // Extract encryption key from connectorURI query param 'k'
    const uri = new URL(request.connectorURI)
    const keyB64 = uri.searchParams.get('k')
    if (!keyB64) {
      return NextResponse.json({ success: false, error: 'Missing key in connectorURI' }, { status: 500 })
    }
    const keyBuffer = Buffer.from(keyB64, 'base64')

    // Store key + requestId (no WASM object - survives hot-reload)
    const sessionId = request.requestId
    sessions.set(sessionId, {
      key: keyBuffer,
      requestId: sessionId,
      createdAt: Date.now(),
    })

    return NextResponse.json({
      success: true,
      data: { connectorURI: request.connectorURI, sessionId },
    })
  } catch (err) {
    globalThis.fetch = originalFetch
    console.error('[cli/bridge POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// ── GET /api/cli/bridge?sessionId=X ───────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('sessionId')
    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'Missing sessionId' }, { status: 400 })
    }

    if (!rateLimit(`cli-bridge-poll:${sessionId}`, 60, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    const session = sessions.get(sessionId)
    if (!session) {
      return NextResponse.json({ success: true, data: { status: 'expired' } })
    }

    // Poll the World ID bridge directly via HTTP
    const bridgeResp = await fetch(
      `https://bridge.worldcoin.org/response/${session.requestId}`,
      { headers: { 'User-Agent': 'Arkora/2.0' } }
    )

    const bridgeText = await bridgeResp.text()

    // Empty response or non-200 = still waiting or expired
    if (!bridgeText || !bridgeResp.ok) {
      return NextResponse.json({ success: true, data: { status: 'pending' } })
    }

    let bridgeData: { status?: string; response?: { iv: string; payload: string } | null }
    try {
      bridgeData = JSON.parse(bridgeText)
    } catch {
      return NextResponse.json({ success: true, data: { status: 'pending' } })
    }

    // Still waiting
    if (bridgeData.status === 'initialized' || !bridgeData.response) {
      return NextResponse.json({ success: true, data: { status: 'pending' } })
    }

    // Got the encrypted proof - decrypt it
    let idkitResult: Record<string, unknown>
    try {
      const decrypted = decryptBridgeResponse(session.key, bridgeData.response.iv, bridgeData.response.payload)
      idkitResult = JSON.parse(decrypted)
    } catch {
      return NextResponse.json({
        success: true,
        data: { status: 'failed', error: 'Failed to decrypt proof' },
      })
    }

    // The bridge returns a v3 legacy proof (flat: credential_type, merkle_root,
    // nullifier_hash, proof). Use on-chain verification like the MiniKit flow.
    const { verifyWorldIdProof } = await import('@/lib/worldid')

    const actionId = process.env.NEXT_PUBLIC_ACTION_ID
    if (!actionId) {
      return NextResponse.json({
        success: true,
        data: { status: 'failed', error: 'ACTION_ID not configured' },
      })
    }

    const verifyResult = await verifyWorldIdProof(
      idkitResult as unknown as import('@worldcoin/minikit-js').ISuccessResult,
      actionId,
      undefined
    )

    let nullifierHash: string | undefined

    if (!verifyResult.success || !verifyResult.nullifierHash) {
      const alreadyVerified =
        verifyResult.error?.toLowerCase().includes('already') ||
        verifyResult.error?.toLowerCase().includes('max_verifications')

      if (alreadyVerified) {
        const clientNullifier = (idkitResult.nullifier_hash ?? idkitResult.nullifier) as string | undefined
        if (clientNullifier) {
          const existingUser = await getUserByNullifier(clientNullifier)
          if (existingUser) nullifierHash = clientNullifier
        }
      }

      if (!nullifierHash) {
        return NextResponse.json({
          success: true,
          data: { status: 'failed', error: verifyResult.error ?? 'Verification failed' },
        })
      }
    } else {
      nullifierHash = verifyResult.nullifierHash
    }

    // Create/find user and resolve linked identities
    let raw: string
    let handle: string | null = null
    try {
      const effectiveWallet = `idkit_${nullifierHash.slice(0, 40)}`
      const worldIdUser = await getOrCreateUser(nullifierHash, effectiveWallet, undefined, true)
      handle = worldIdUser?.pseudoHandle ?? null

      // Resolve to wallet identity if linked (matches /api/verify logic)
      const { walletToNullifier } = await import('@/lib/serverAuth')
      if (
        worldIdUser?.walletAddress &&
        !worldIdUser.walletAddress.startsWith('idkit_')
      ) {
        const wltNullifier = walletToNullifier(worldIdUser.walletAddress)
        const walletUser = await getUserByNullifier(wltNullifier)
        if (walletUser) {
          nullifierHash = wltNullifier
          handle = walletUser.pseudoHandle ?? handle
        }
      }

      const activeKeys = await countActiveKeysByOwner(nullifierHash)
      if (activeKeys >= 5) {
        sessions.delete(sessionId)
        return NextResponse.json({
          success: true,
          data: { status: 'failed', error: 'API key limit reached (max 5)' },
        })
      }

      const result = await createApiKey(nullifierHash, 'CLI (auto)')
      raw = result.raw
    } catch (dbErr) {
      console.error('[cli/bridge GET] DB error:', dbErr instanceof Error ? dbErr.message : String(dbErr))
      return NextResponse.json({
        success: true,
        data: { status: 'pending' },
      })
    }

    sessions.delete(sessionId)

    return NextResponse.json({
      success: true,
      data: {
        status: 'authorized',
        apiKey: raw,
        handle,
      },
    })
  } catch (err) {
    console.error('[cli/bridge GET]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
