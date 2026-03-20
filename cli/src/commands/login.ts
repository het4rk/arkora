import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import chalk from 'chalk'
import qrcode from 'qrcode-terminal'
import { saveConfig, getConfig, getApiUrl } from '../config.js'

const POLL_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Patches global fetch so IDKit's WASM loader can find the .wasm file
 * from disk instead of trying to fetch it over HTTP.
 */
function patchFetchForWasm(): void {
  const originalFetch = globalThis.fetch
  const require = createRequire(import.meta.url)
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request)?.url
    if (url?.endsWith('.wasm')) {
      const idkitCorePath = dirname(require.resolve('@worldcoin/idkit-core'))
      const wasmPath = resolve(idkitCorePath, 'idkit_wasm_bg.wasm')
      const buffer = readFileSync(wasmPath)
      return new Response(buffer, {
        headers: { 'Content-Type': 'application/wasm' },
      })
    }
    return originalFetch(input, init)
  }) as typeof fetch
}

interface RpContext {
  rp_id: string
  nonce: string
  created_at: number
  expires_at: number
  signature: string
}

export async function loginCommand(): Promise<void> {
  const baseUrl = getApiUrl()

  console.log()
  console.log(chalk.bold('Arkora CLI Login'))
  console.log()

  // 1. Fetch RP context from server (server has the signing key)
  console.log('Connecting to Arkora...')
  let rpContext: RpContext
  try {
    const res = await fetch(`${baseUrl}/api/idkit/context`)
    const json = (await res.json()) as { success: boolean; data?: RpContext; error?: string }
    if (!json.success || !json.data) {
      console.error(chalk.red(json.error ?? 'Failed to get verification context'))
      process.exit(1)
    }
    rpContext = json.data
  } catch (err) {
    console.error(
      chalk.red(
        `Could not reach ${baseUrl}: ${err instanceof Error ? err.message : String(err)}`
      )
    )
    process.exit(1)
  }

  // 2. Initialize IDKit WASM and create bridge request
  patchFetchForWasm()
  const { IDKit, orbLegacy } = await import('@worldcoin/idkit')

  const appId = 'app_e6455c98be7249a87ff42878b7647ab0' as `app_${string}`
  const actionId = 'verifyhuman'

  let connectorURI: string
  let pollUntilCompletion: (opts?: {
    timeout?: number
    signal?: AbortSignal
  }) => Promise<{ success: boolean; result?: unknown; error?: string }>

  try {
    const builder = IDKit.request({
      app_id: appId,
      action: actionId,
      rp_context: rpContext,
      allow_legacy_proofs: true,
    })
    const request = await builder.preset(orbLegacy())
    connectorURI = request.connectorURI
    pollUntilCompletion = request.pollUntilCompletion.bind(request)
  } catch (err) {
    console.error(
      chalk.red(
        `Failed to create verification request: ${err instanceof Error ? err.message : String(err)}`
      )
    )
    process.exit(1)
  }

  // 3. Display the World ID QR code
  console.log()
  console.log('Scan with World App to verify your identity:')
  console.log()
  qrcode.generate(connectorURI, { small: true })
  console.log()
  console.log('Waiting for verification...')

  // 4. Poll the World ID bridge for the proof
  const result = await pollUntilCompletion({ timeout: POLL_TIMEOUT_MS })

  if (!result.success || !result.result) {
    const msg =
      result.error === 'timeout'
        ? 'Timed out waiting for verification. Run `arkora login` again.'
        : result.error === 'user_rejected'
          ? 'Verification declined. Run `arkora login` to try again.'
          : `Verification failed: ${result.error ?? 'unknown error'}`
    console.error(chalk.red(msg))
    process.exit(1)
  }

  console.log('Verified. Creating API key...')

  // 5. Send the proof to our server to verify + get API key
  try {
    const res = await fetch(`${baseUrl}/api/cli/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idkitResult: result.result }),
    })
    const json = (await res.json()) as {
      success: boolean
      data?: { apiKey: string }
      error?: string
    }

    if (!json.success || !json.data?.apiKey) {
      console.error(chalk.red(json.error ?? 'Failed to create API key'))
      process.exit(1)
    }

    const config = getConfig()
    config.apiKey = json.data.apiKey
    saveConfig(config)

    console.log()
    console.log(chalk.green('Logged in successfully.'))
    console.log(chalk.dim('Config saved to ~/.config/arkora/config.json'))
  } catch (err) {
    console.error(
      chalk.red(
        `Server error: ${err instanceof Error ? err.message : String(err)}`
      )
    )
    process.exit(1)
  }
}
