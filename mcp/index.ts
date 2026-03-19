#!/usr/bin/env node
/**
 * Arkora MCP Server
 * Exposes verified-human opinion data as MCP tools for AI agents.
 *
 * Transports: stdio (default) or SSE (--sse flag).
 *
 * Usage:
 *   npx tsx mcp/index.ts           # stdio transport
 *   npx tsx mcp/index.ts --sse     # SSE transport on port 3001
 *
 * Environment:
 *   ARKORA_API_URL  - Base URL (default: http://localhost:3000)
 *   ARKORA_API_KEY  - API key for v2 endpoints
 *   MCP_PORT        - SSE port (default: 3001)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { tools } from './tools.js'
import { createServer } from 'http'
import { z } from 'zod'

const server = new McpServer({
  name: 'arkora',
  version: '1.0.0',
})

// Register all tools
for (const tool of tools) {
  // Build zod schema from inputSchema properties
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const [key, prop] of Object.entries(tool.inputSchema.properties)) {
    let field: z.ZodTypeAny = z.string().describe(prop.description)
    if (prop.enum) {
      field = z.enum(prop.enum as [string, ...string[]]).describe(prop.description)
    }
    if (!tool.inputSchema.required?.includes(key)) {
      field = field.optional()
    }
    shape[key] = field
  }

  server.tool(
    tool.name,
    tool.description,
    shape,
    async (args) => {
      try {
        const result = await tool.handler(args as Record<string, string>)
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(result, null, 2) },
          ],
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
}

async function main() {
  const useSSE = process.argv.includes('--sse')

  if (useSSE) {
    const port = parseInt(process.env.MCP_PORT ?? '3001', 10)
    let transport: SSEServerTransport | null = null

    const httpServer = createServer(async (req, res) => {
      if (req.url === '/sse') {
        transport = new SSEServerTransport('/messages', res)
        await server.connect(transport)
      } else if (req.url === '/messages' && req.method === 'POST') {
        if (transport) {
          await transport.handlePostMessage(req, res)
        } else {
          res.writeHead(503)
          res.end('No active SSE connection')
        }
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
    })

    httpServer.listen(port, () => {
      console.error(`Arkora MCP server (SSE) running on port ${port}`)
    })
  } else {
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error('Arkora MCP server (stdio) running')
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
