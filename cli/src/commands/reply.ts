import chalk from 'chalk'
import { requireApiKey } from '../config.js'
import { api } from '../api.js'
import { accent } from '../theme.js'

export async function replyCommand(
  postId: string,
  options: { body?: string }
): Promise<void> {
  const key = requireApiKey()

  if (!options.body?.trim()) {
    console.error(chalk.red('Reply body is required. Use --body "your reply"'))
    process.exit(1)
  }

  const res = await api<{ id: string; body: string; createdAt: string }>(
    '/replies',
    key,
    { method: 'POST', body: { postId, body: options.body } }
  )

  const reply = res.data!
  console.log()
  console.log(accent('Reply posted.'))
  console.log(chalk.dim(`  ID: ${reply.id}`))
  console.log()
}
