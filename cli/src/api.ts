import { getApiUrl } from './config.js'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  nextCursor?: string | null
}

export async function api<T>(
  path: string,
  apiKey: string,
  options: { method?: string; body?: Record<string, unknown> } = {}
): Promise<ApiResponse<T>> {
  const baseUrl = getApiUrl()
  // Validate API URL is a trusted origin
  if (!/^https?:\/\/[a-zA-Z0-9._-]+(:\d+)?$/.test(baseUrl)) {
    throw new Error(`Untrusted API URL: ${baseUrl}`)
  }
  // Validate API key format before sending
  if (!/^ark_[a-zA-Z0-9]{32,128}$/.test(apiKey)) {
    throw new Error('Invalid API key format')
  }
  const url = `${baseUrl}/api/v1${path}`
  const headers: Record<string, string> = {
    'X-API-Key': apiKey,
  }

  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers,
  }

  if (options.body) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(options.body)
  }

  const res = await fetch(url, init)
  const json = (await res.json()) as ApiResponse<T>

  if (!json.success) {
    throw new Error(json.error ?? `API error (${res.status})`)
  }

  return json
}
