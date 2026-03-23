import Pusher from 'pusher'

// Lazy-initialized Pusher server client.
// Validates env vars on first use (not at import time, since build phase lacks them).
let _pusher: Pusher | null = null

function getPusherServer(): Pusher {
  if (_pusher) return _pusher
  const appId = process.env.PUSHER_APP_ID
  const key = process.env.PUSHER_KEY
  const secret = process.env.PUSHER_SECRET
  const cluster = process.env.PUSHER_CLUSTER
  if (!appId || !key || !secret || !cluster) {
    console.error('[Pusher] Missing env vars: PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER')
    throw new Error('Pusher credentials not configured')
  }
  _pusher = new Pusher({ appId, key, secret, cluster, useTLS: true })
  return _pusher
}

// Proxy defers initialization until first method call
export const pusherServer = new Proxy({} as Pusher, {
  get(_target, prop) {
    const instance = getPusherServer()
    const value = instance[prop as keyof Pusher]
    if (typeof value === 'function') {
      return value.bind(instance)
    }
    return value
  },
})
