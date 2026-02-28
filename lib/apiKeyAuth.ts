import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/db/apiKeys'

/**
 * Extracts and validates the API key from the request.
 * Accepts: X-API-Key header or Authorization: Bearer <key>
 * Returns { ok: true } on success, or a 401/403 NextResponse on failure.
 */
export async function requireApiKey(
  req: NextRequest
): Promise<{ ok: true; key: string } | NextResponse> {
  const header =
    req.headers.get('x-api-key') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  if (!header) {
    return NextResponse.json(
      { success: false, error: 'Missing API key. Pass X-API-Key header.' },
      {
        status: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'WWW-Authenticate': 'Bearer realm="Arkora API"',
        },
      }
    )
  }

  const valid = await validateApiKey(header)
  if (!valid) {
    return NextResponse.json(
      { success: false, error: 'Invalid or revoked API key.' },
      { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }

  return { ok: true, key: header }
}

/** CORS headers for all v1 public data endpoints. */
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'X-API-Key, Authorization',
}
