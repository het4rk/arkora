import { validateEnv } from '@/lib/env'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Validate all required env vars - skip during build (env vars aren't available)
if (process.env.NEXT_PHASE !== 'phase-production-build') {
  validateEnv()
}

// Singleton pattern - prevents multiple connections in dev (Next.js hot reload)
declare global {
  // eslint-disable-next-line no-var
  var _pgClient: postgres.Sql | undefined
}

function getClient(): postgres.Sql {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  if (globalThis._pgClient) return globalThis._pgClient
  const client = postgres(process.env.DATABASE_URL, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  })
  // Cache the client in both dev and production to prevent connection exhaustion
  // on serverless warm instances (Neon free tier: 20 connections max)
  globalThis._pgClient = client
  return client
}

export const db = drizzle(getClient(), { schema })

export type Db = typeof db
