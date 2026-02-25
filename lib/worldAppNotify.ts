import { getUserByNullifier } from '@/lib/db/users'

/**
 * Sends a native World App push notification to a user identified by their nullifierHash.
 * Fire-and-forget — never throws, never blocks the caller.
 */
export async function worldAppNotify(
  recipientHash: string,
  title: string,
  message: string,
  miniAppPath: string,
): Promise<void> {
  const apiKey = process.env.WORLDCOIN_API_KEY
  const appId = process.env.NEXT_PUBLIC_APP_ID
  if (!apiKey || !appId) return

  try {
    const user = await getUserByNullifier(recipientHash)
    if (!user?.walletAddress) return

    void fetch('https://developer.worldcoin.org/api/v2/minikit/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        wallet_addresses: [user.walletAddress],
        title,
        message,
        mini_app_path: miniAppPath,
      }),
    }).catch(() => {/* silent */})
  } catch {
    // Non-critical — never surface push notification failures
  }
}
