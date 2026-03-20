import chalk from 'chalk'
import { requireApiKey } from '../config.js'
import { api } from '../api.js'
import { accent, accentBold, dim } from '../theme.js'

interface Notification {
  id: string
  type: string
  referenceId: string | null
  actorDisplay: string | null
  read: boolean
  createdAt: string
}

const TYPE_LABELS: Record<string, string> = {
  reply: 'replied to your post',
  mention: 'mentioned you',
  follow: 'followed you',
  like: 'upvoted your post',
  dm: 'sent you a message',
  quote: 'quoted your post',
  repost: 'reposted your post',
}

export async function notificationsCommand(options: { read?: boolean }): Promise<void> {
  const key = requireApiKey()

  if (options.read) {
    await api('/notifications', key, { method: 'POST' })
    console.log(dim('All notifications marked as read.'))
    return
  }

  const res = await api<{ notifications: Notification[]; unreadCount: number }>(
    '/notifications',
    key
  )
  const { notifications, unreadCount } = res.data!

  console.log()
  if (unreadCount > 0) {
    console.log(accentBold(`${unreadCount} unread`))
  }

  if (notifications.length === 0) {
    console.log(dim('No notifications.'))
    console.log()
    return
  }

  console.log()
  for (const n of notifications) {
    const actor = n.actorDisplay ? accent(n.actorDisplay) : dim('Someone')
    const action = TYPE_LABELS[n.type] ?? n.type
    const unread = n.read ? '' : chalk.yellow(' *')
    const ref = n.referenceId ? dim(` (${n.referenceId.slice(0, 8)}...)`) : ''
    const time = new Date(n.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    console.log(`  ${actor} ${action}${ref}${unread}  ${dim(time)}`)
  }
  console.log()
  console.log(dim('Use --read to mark all as read'))
  console.log()
}
