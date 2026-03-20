import chalk from 'chalk'
import { requireApiKey } from '../config.js'
import { api } from '../api.js'
import { up, down } from '../theme.js'

export async function voteCommand(
  postId: string,
  options: { up?: boolean; down?: boolean; undo?: boolean }
): Promise<void> {
  const key = requireApiKey()

  let direction: number
  if (options.undo) {
    direction = 0
  } else if (options.up) {
    direction = 1
  } else if (options.down) {
    direction = -1
  } else {
    console.error(chalk.red('Specify --up, --down, or --undo'))
    process.exit(1)
  }

  await api('/vote', key, {
    method: 'POST',
    body: { postId, direction },
  })

  const msg =
    direction === 1 ? up('Upvoted.')
    : direction === -1 ? down('Downvoted.')
    : chalk.dim('Vote removed.')
  console.log()
  console.log(msg)
  console.log()
}
