/**
 * Startup environment variable validation.
 * Import this module at the top of any server-side entry point that needs
 * guaranteed env vars. Throws a single clear error listing every missing var
 * rather than crashing with a cryptic TypeError deep in a library.
 *
 * Usage: import '@/lib/env' at the top of lib/pusher.ts, lib/db/index.ts, etc.
 */

const REQUIRED_SERVER_VARS = [
  'DATABASE_URL',
  'PUSHER_APP_ID',
  'PUSHER_KEY',
  'PUSHER_SECRET',
  'PUSHER_CLUSTER',
  'WORLD_CHAIN_RPC',
  'WORLD_ID_ROUTER',
] as const

const REQUIRED_PUBLIC_VARS = [
  'NEXT_PUBLIC_APP_ID',
  'NEXT_PUBLIC_RP_ID',
  'NEXT_PUBLIC_PUSHER_KEY',
  'NEXT_PUBLIC_PUSHER_CLUSTER',
] as const

export function validateEnv(): void {
  const missing: string[] = []

  for (const key of REQUIRED_SERVER_VARS) {
    if (!process.env[key]) missing.push(key)
  }

  // Public vars are available server-side too
  for (const key of REQUIRED_PUBLIC_VARS) {
    if (!process.env[key]) missing.push(key)
  }

  if (missing.length > 0) {
    throw new Error(
      `[Arkora] Missing required environment variables:\n  ${missing.join('\n  ')}\n\n` +
      `Copy .env.example to .env.local and fill in the values.`
    )
  }
}

/**
 * Type-safe env accessor - throws if the var is not set.
 * Use this instead of `process.env.FOO!` to get clear errors.
 */
export function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`[Arkora] Required environment variable "${key}" is not set.`)
  }
  return value
}
