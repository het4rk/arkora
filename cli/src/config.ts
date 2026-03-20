import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const CONFIG_DIR = join(homedir(), '.config', 'arkora')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

interface ArkoraConfig {
  apiKey?: string
  apiUrl?: string
  skinId?: string
  customHex?: string
}

export function getConfig(): ArkoraConfig {
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8')
    return JSON.parse(raw) as ArkoraConfig
  } catch {
    return {}
  }
}

export function saveConfig(config: ArkoraConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}

export function getApiKey(): string | undefined {
  return getConfig().apiKey
}

export function getApiUrl(): string {
  return process.env.ARKORA_API_URL ?? getConfig().apiUrl ?? 'https://arkora.app'
}

export function requireApiKey(): string {
  const key = getApiKey()
  if (!key) {
    console.error('Not logged in. Run `arkora login` first.')
    process.exit(1)
  }
  return key
}
