import * as Sentry from '@sentry/nextjs'
import { useArkoraStore } from '@/store/useArkoraStore'

const MAX_RETRIES = 2
const BASE_DELAY_MS = 500

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryable(error: unknown, res: Response | null): boolean {
  if (error instanceof TypeError) return true
  if (res && res.status >= 500) return true
  return false
}

/**
 * Wrapper around fetch that detects 401 responses and clears stale Zustand
 * auth state. When the server rejects a request because the httpOnly cookie
 * is missing (e.g. World App webview dropped it, browser cleared cookies),
 * Zustand may still hold cached nullifierHash/isVerified from localStorage.
 * This forces a sign-out so the user sees the proper auth screen instead of
 * a generic "could not load" error.
 *
 * Retries on network errors (TypeError) and 5xx server errors with
 * exponential backoff (500ms, 1000ms). Does not retry 4xx errors.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let lastError: unknown = null
  let res: Response | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      res = await fetch(input, init)
      lastError = null
    } catch (err) {
      lastError = err
      res = null
    }

    const isLastAttempt = attempt === MAX_RETRIES
    if (isLastAttempt) break

    if (!isRetryable(lastError, res)) break

    await delay(BASE_DELAY_MS * Math.pow(2, attempt))
  }

  const method = (init?.method ?? 'GET').toUpperCase()
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

  if (lastError) {
    Sentry.addBreadcrumb({
      category: 'api',
      message: `${method} ${url}`,
      level: 'error',
      data: { error: String(lastError) },
    })
    throw lastError
  }

  Sentry.addBreadcrumb({
    category: 'api',
    message: `${method} ${url}`,
    level: res!.ok ? 'info' : 'warning',
    data: { status: res!.status },
  })

  if (res!.status === 401) {
    const { signOut } = useArkoraStore.getState()
    signOut()
  }
  return res!
}
