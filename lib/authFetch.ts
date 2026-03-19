import { useArkoraStore } from '@/store/useArkoraStore'

/**
 * Wrapper around fetch that detects 401 responses and clears stale Zustand
 * auth state. When the server rejects a request because the httpOnly cookie
 * is missing (e.g. World App webview dropped it, browser cleared cookies),
 * Zustand may still hold cached nullifierHash/isVerified from localStorage.
 * This forces a sign-out so the user sees the proper auth screen instead of
 * a generic "could not load" error.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init)
  if (res.status === 401) {
    const { signOut } = useArkoraStore.getState()
    signOut()
  }
  return res
}
