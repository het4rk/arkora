import { validateEnv } from '@/lib/env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

// Validate all required env vars - skip during build (env vars aren't available)
if (process.env.NEXT_PHASE !== 'phase-production-build') {
  validateEnv()
}

function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  const sql = neon(process.env.DATABASE_URL)
  return drizzle(sql, { schema })
}

export const db = getDb()
export type Db = typeof db
