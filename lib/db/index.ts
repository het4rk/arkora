import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Singleton pattern — prevents multiple connections in dev (Next.js hot reload)
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
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  })
  if (process.env.NODE_ENV !== 'production') {
    globalThis._pgClient = client
  }
  return client
}

export const db = drizzle(getClient(), { schema })

export type Db = typeof db
