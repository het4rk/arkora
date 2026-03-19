/**
 * x402 micropayment pricing and response generation for premium v2 endpoints.
 * Prices are in USDC on World Chain (eip155:480).
 *
 * Format follows the x402 protocol spec:
 * https://github.com/coinbase/x402
 */

const WORLD_CHAIN_NETWORK = 'eip155:480' as const
// USDC contract on World Chain
const WORLD_CHAIN_USDC = '0x79A02482A880bCE3B13f4c26BDdE2869C35C6e0d'

export interface EndpointPricing {
  /** Price per request in USD (human-readable, e.g. "0.001") */
  price: string
  /** Price in USDC base units (6 decimals, e.g. "1000" for $0.001) */
  baseUnits: string
  /** Human-readable description */
  description: string
}

export const PRICING: Record<string, EndpointPricing> = {
  'v2/sentiment': {
    price: process.env.X402_PRICE_SENTIMENT ?? '0.001',
    baseUnits: '1000',
    description: 'Board sentiment aggregation (upvote/downvote ratio)',
  },
  'v2/trends': {
    price: process.env.X402_PRICE_TRENDS ?? '0.001',
    baseUnits: '1000',
    description: 'Trending topics by post velocity delta',
  },
  'v2/demographics': {
    price: process.env.X402_PRICE_DEMOGRAPHICS ?? '0.002',
    baseUnits: '2000',
    description: 'Geographic vote distribution by country',
  },
}

/** Wallet address to receive x402 micropayments (World Chain USDC). */
export const PAYMENT_WALLET = process.env.X402_PAYMENT_WALLET ?? ''

/**
 * Builds a spec-compliant x402 PaymentRequired response body for a given endpoint.
 * Returns null if the endpoint has no pricing or no payment wallet is configured.
 *
 * Format matches the x402 protocol:
 * - x402Version: 1
 * - resource: { url, description }
 * - accepts: [{ scheme, network, asset, amount, payTo, maxTimeoutSeconds, extra }]
 */
export function buildPaymentRequired(endpoint: string, resourceUrl: string) {
  const pricing = PRICING[endpoint]
  if (!pricing || !PAYMENT_WALLET) return null

  return {
    x402Version: 1,
    resource: {
      url: resourceUrl,
      description: pricing.description,
      mimeType: 'application/json',
    },
    accepts: [
      {
        scheme: 'exact',
        network: WORLD_CHAIN_NETWORK,
        asset: WORLD_CHAIN_USDC,
        amount: pricing.baseUnits,
        payTo: PAYMENT_WALLET,
        maxTimeoutSeconds: 60,
        extra: {
          name: 'USDC',
          decimals: 6,
          priceUsd: pricing.price,
        },
      },
    ],
  }
}
