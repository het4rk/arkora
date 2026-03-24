import { validateEnv } from '@/lib/env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

// Validate all required env vars - skip during build (env vars aren't available)
if (process.env.NEXT_PHASE !== 'phase-production-build') {
  validateEnv()
}

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

function getDb() {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set')
    }
    const sql = neon(process.env.DATABASE_URL)
    _db = drizzle(sql, { schema })
  }
  return _db
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
export type Db = ReturnType<typeof drizzle<typeof schema>>
