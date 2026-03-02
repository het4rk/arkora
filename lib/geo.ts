import { NextRequest } from 'next/server'

/** Countries where World App in-app payments are not available. */
const PAYMENT_RESTRICTED = new Set(['ID', 'PH'])

/** Extract ISO country code from edge/proxy headers. */
export function getCountryCode(req: NextRequest): string | null {
  return (
    req.headers.get('x-vercel-ip-country') ??
    req.headers.get('cf-ipcountry') ??
    req.headers.get('x-country-code') ??
    (process.env.NODE_ENV === 'development' ? 'US' : null)
  )
}

/** Returns true if the request originates from a country where payments are blocked. */
export function isPaymentBlocked(req: NextRequest): boolean {
  const cc = getCountryCode(req)
  return cc !== null && PAYMENT_RESTRICTED.has(cc)
}
