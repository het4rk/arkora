import { describe, it, expect, vi } from 'vitest'

// Mock all external dependencies before importing
vi.mock('@worldcoin/agentkit', () => ({
  parseAgentkitHeader: vi.fn(),
  validateAgentkitMessage: vi.fn(),
  verifyAgentkitSignature: vi.fn(),
  createAgentBookVerifier: vi.fn(() => ({
    lookupHuman: vi.fn(),
  })),
  declareAgentkitExtension: vi.fn(() => ({ agentkit: { info: {}, supportedChains: [] } })),
}))

vi.mock('@/lib/db/agentkit', () => ({
  DrizzleAgentKitStorage: class MockStorage {
    hasUsedNonce = vi.fn().mockResolvedValue(false)
    recordNonce = vi.fn().mockResolvedValue(undefined)
    getUsageCount = vi.fn().mockResolvedValue(0)
    incrementUsage = vi.fn().mockResolvedValue(undefined)
  },
}))

vi.mock('@/lib/apiKeyAuth', () => ({
  requireApiKey: vi.fn(),
  CORS_HEADERS: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'X-API-Key, Authorization',
  },
}))

vi.mock('@/lib/db/apiKeys', () => ({
  validateApiKey: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  validateEnv: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {},
}))

vi.mock('@/lib/x402', () => ({
  buildPaymentRequired: vi.fn((endpoint: string, url: string) => {
    // Only return payment params when wallet is "configured"
    if (process.env.X402_PAYMENT_WALLET) {
      return {
        x402Version: 1,
        resource: { url, description: 'test', mimeType: 'application/json' },
        accepts: [{
          scheme: 'exact',
          network: 'eip155:480',
          asset: '0xUSDC',
          amount: '1000',
          payTo: process.env.X402_PAYMENT_WALLET,
          maxTimeoutSeconds: 60,
          extra: {},
        }],
      }
    }
    return null
  }),
}))

import { requireApiKey } from '@/lib/apiKeyAuth'
import { NextRequest, NextResponse } from 'next/server'

describe('agentAuth', () => {
  describe('V2_CORS_HEADERS', () => {
    it('includes agentkit and x-agentkit headers', async () => {
      const { V2_CORS_HEADERS } = await import('@/lib/agentAuth')
      expect(V2_CORS_HEADERS['Access-Control-Allow-Headers']).toContain('agentkit')
      expect(V2_CORS_HEADERS['Access-Control-Allow-Headers']).toContain('x-agentkit')
    })

    it('includes X-402-Payment header for x402 flow', async () => {
      const { V2_CORS_HEADERS } = await import('@/lib/agentAuth')
      expect(V2_CORS_HEADERS['Access-Control-Allow-Headers']).toContain('X-402-Payment')
    })
  })

  describe('requireV2Auth', () => {
    it('returns 402 with extensions when no auth headers present', async () => {
      const { requireV2Auth } = await import('@/lib/agentAuth')
      const req = new NextRequest('https://arkora.vercel.app/api/v2/posts')

      const result = await requireV2Auth(req)
      expect(result).toBeInstanceOf(NextResponse)
      if (result instanceof NextResponse) {
        expect(result.status).toBe(402)
        const body = await result.json()
        expect(body.success).toBe(false)
        expect(body.extensions).toBeDefined()
        expect(body.extensions.agentkit).toBeDefined()
      }
    })

    it('falls back to API key auth when X-API-Key present', async () => {
      const { requireV2Auth } = await import('@/lib/agentAuth')
      const mockRequireApiKey = vi.mocked(requireApiKey)
      mockRequireApiKey.mockResolvedValueOnce({ ok: true, key: 'test-hash' })

      const req = new NextRequest('https://arkora.vercel.app/api/v2/posts', {
        headers: { 'X-API-Key': 'ark_test123' },
      })

      const result = await requireV2Auth(req)
      expect(result).not.toBeInstanceOf(NextResponse)
      if (!(result instanceof NextResponse)) {
        expect(result.ok).toBe(true)
        expect(result.authType).toBe('apikey')
        expect(result.key).toBe('test-hash')
      }
    })
  })

  describe('requirePremiumAuth', () => {
    it('returns 402 with extensions AND paymentRequired when no agentkit header', async () => {
      // Set up x402 env var so payment params are generated
      const originalWallet = process.env.X402_PAYMENT_WALLET
      process.env.X402_PAYMENT_WALLET = '0x1234567890abcdef1234567890abcdef12345678'

      try {
        const { requirePremiumAuth } = await import('@/lib/agentAuth')
        const req = new NextRequest('https://arkora.vercel.app/api/v2/sentiment?boardId=ai')

        const result = await requirePremiumAuth(req, 'v2/sentiment')
        expect(result).toBeInstanceOf(NextResponse)
        if (result instanceof NextResponse) {
          expect(result.status).toBe(402)
          const body = await result.json()
          expect(body.success).toBe(false)
          expect(body.extensions).toBeDefined()
          // x402 payment params should be present when wallet is configured
          expect(body.paymentRequired).toBeDefined()
          expect(body.paymentRequired.x402Version).toBe(1)
          expect(body.paymentRequired.accepts).toBeInstanceOf(Array)
          expect(body.paymentRequired.accepts[0].network).toBe('eip155:480')
          expect(body.paymentRequired.accepts[0].payTo).toBe('0x1234567890abcdef1234567890abcdef12345678')
        }
      } finally {
        process.env.X402_PAYMENT_WALLET = originalWallet
      }
    })

    it('returns 402 without paymentRequired when wallet not configured', async () => {
      const originalWallet = process.env.X402_PAYMENT_WALLET
      process.env.X402_PAYMENT_WALLET = ''

      try {
        const { requirePremiumAuth } = await import('@/lib/agentAuth')
        const req = new NextRequest('https://arkora.vercel.app/api/v2/trends?limit=10')

        const result = await requirePremiumAuth(req, 'v2/trends')
        expect(result).toBeInstanceOf(NextResponse)
        if (result instanceof NextResponse) {
          expect(result.status).toBe(402)
          const body = await result.json()
          expect(body.paymentRequired).toBeUndefined()
          // Extensions should still be present (AgentKit discovery)
          expect(body.extensions).toBeDefined()
        }
      } finally {
        process.env.X402_PAYMENT_WALLET = originalWallet
      }
    })
  })
})
