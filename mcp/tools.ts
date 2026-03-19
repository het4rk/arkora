/**
 * MCP tool definitions for Arkora data.
 *
 * Public data tools (posts, polls, stats) call the v2 API with API key auth.
 * Premium data tools (sentiment, trends) call analytics functions directly,
 * bypassing AgentKit auth since the MCP server runs as a trusted internal service.
 */

const BASE_URL = process.env.ARKORA_API_URL ?? 'http://localhost:3000'
const API_KEY = process.env.ARKORA_API_KEY ?? ''

// Flag for whether we're running in the same process as the Next.js app
// (direct DB access available) or as a remote MCP server (API-only).
const HAS_DIRECT_DB = process.env.ARKORA_DIRECT_DB === 'true'

async function apiFetch(path: string, params?: Record<string, string>): Promise<unknown> {
  const url = new URL(`/api/v2${path}`, BASE_URL)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v)
    }
  }

  const res = await fetch(url.toString(), {
    headers: { 'X-API-Key': API_KEY },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API error ${res.status}: ${body}`)
  }

  return res.json()
}

/**
 * Direct analytics access for premium endpoints.
 * Dynamically imports the analytics module to avoid requiring DB connection
 * when running as a remote MCP server.
 */
async function directSentiment(boardId: string, window: string): Promise<unknown> {
  const { getSentiment, isValidWindow } = await import('../lib/db/analytics.js')
  if (!isValidWindow(window)) throw new Error('window must be 24h, 7d, or 30d')
  const data = await getSentiment(boardId, window)
  return { success: true, data }
}

async function directTrends(limit: number, window: string): Promise<unknown> {
  const { getTrends, isValidWindow } = await import('../lib/db/analytics.js')
  if (!isValidWindow(window)) throw new Error('window must be 24h, 7d, or 30d')
  const data = await getTrends(limit, window)
  return { success: true, data }
}

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, { type: string; description: string; enum?: string[] }>
    required?: string[]
  }
  handler: (args: Record<string, string>) => Promise<unknown>
}

export const tools: ToolDefinition[] = [
  {
    name: 'arkora_search_posts',
    description:
      'Search verified-human posts on Arkora by board, type, or keyword. ' +
      'Every post is from a World ID-verified unique human.',
    inputSchema: {
      type: 'object',
      properties: {
        boardId: { type: 'string', description: 'Board slug to filter (e.g. "politics", "ai")' },
        type: { type: 'string', description: 'Post type filter', enum: ['text', 'poll', 'repost'] },
        limit: { type: 'string', description: 'Number of results (1-50, default 20)' },
      },
    },
    handler: async (args) => apiFetch('/posts', args),
  },
  {
    name: 'arkora_get_poll_results',
    description:
      'Get sybil-resistant poll results from Arkora. ' +
      'Each vote is one verified human - no bots, no duplicates.',
    inputSchema: {
      type: 'object',
      properties: {
        boardId: { type: 'string', description: 'Board slug to filter' },
        active: { type: 'string', description: 'Set to "true" for only active polls' },
        limit: { type: 'string', description: 'Number of results (1-50, default 20)' },
      },
    },
    handler: async (args) => apiFetch('/polls', args),
  },
  {
    name: 'arkora_get_sentiment',
    description:
      'Get aggregated sentiment score for a board/topic. ' +
      'Score is 0-1 (0 = negative, 1 = positive) based on verified-human votes.',
    inputSchema: {
      type: 'object',
      properties: {
        boardId: { type: 'string', description: 'Board slug (required)' },
        window: { type: 'string', description: 'Time window', enum: ['24h', '7d', '30d'] },
      },
      required: ['boardId'],
    },
    handler: async (args) => {
      if (HAS_DIRECT_DB) {
        return directSentiment(args.boardId!, args.window ?? '24h')
      }
      return apiFetch('/sentiment', args)
    },
  },
  {
    name: 'arkora_get_trends',
    description:
      'Get trending topics on Arkora ranked by post velocity delta. ' +
      'Shows which boards are gaining momentum among verified humans.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'string', description: 'Number of trending topics (1-50, default 10)' },
        window: { type: 'string', description: 'Time window', enum: ['24h', '7d', '30d'] },
      },
    },
    handler: async (args) => {
      if (HAS_DIRECT_DB) {
        const limit = Math.min(Math.max(1, parseInt(args.limit ?? '10', 10) || 10), 50)
        return directTrends(limit, args.window ?? '24h')
      }
      return apiFetch('/trends', args)
    },
  },
  {
    name: 'arkora_get_stats',
    description:
      'Get aggregate Arkora platform statistics: total posts, polls, ' +
      'verified humans, and poll votes.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => apiFetch('/stats'),
  },
]
