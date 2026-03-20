import chalk from 'chalk'
import { requireApiKey } from '../config.js'
import { api } from '../api.js'
import { accent, dim, board } from '../theme.js'

interface PostResult {
  id: string
  title: string
  boardId: string
  createdAt: string
}

export async function postCommand(
  title: string,
  options: { body?: string; board?: string }
): Promise<void> {
  const key = requireApiKey()

  const payload: Record<string, unknown> = { title }
  if (options.body) payload.body = options.body
  if (options.board) payload.boardId = options.board

  const res = await api<PostResult>('/posts', key, {
    method: 'POST',
    body: payload,
  })

  const post = res.data!
  console.log()
  console.log(accent('Post created.'))
  console.log(`  ${chalk.bold(post.title)}`)
  console.log(`  Board: ${board(post.boardId)}`)
  console.log(`  ID: ${dim(post.id)}`)
  console.log()
}
