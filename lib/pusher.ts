import Pusher from 'pusher'

// Singleton server-side Pusher client.
// Credentials live in server-only env vars (never NEXT_PUBLIC_).
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
})
