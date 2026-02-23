import { config } from 'dotenv'
import type { Config } from 'drizzle-kit'

// Drizzle Kit runs outside Next.js so it doesn't auto-load .env.local
config({ path: '.env.local' })

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config
