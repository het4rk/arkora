import chalk from 'chalk'
import { requireApiKey } from '../config.js'
import { api } from '../api.js'

interface FeedPost {
  id: string
  title: string
  body: string
  boardId: string
  type: string
  upvotes: number
  downvotes: number
  replyCount: number
  viewCount: number
  createdAt: string
  author: { handle: string | null; isVerified: boolean }
}

export async function feedCommand(options: { board?: string; limit?: string }): Promise<void> {
  const key = requireApiKey()
  const params = new URLSearchParams()
  if (options.board) params.set('boardId', options.board)
  if (options.limit) params.set('limit', options.limit)

  const query = params.toString()
  const path = `/posts${query ? `?${query}` : ''}`

  const res = await api<FeedPost[]>(path, key)
  const posts = res.data ?? []

  if (posts.length === 0) {
    console.log(chalk.dim('No posts found.'))
    return
  }

  console.log()
  for (const post of posts) {
    const author = post.author.handle ?? chalk.dim('anon')
    const board = chalk.cyan(`#${post.boardId}`)
    const votes = chalk.green(`+${post.upvotes}`) + '/' + chalk.red(`-${post.downvotes}`)
    const replies = chalk.dim(`${post.replyCount} replies`)
    const time = new Date(post.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    console.log(`${chalk.bold(post.title)}`)
    console.log(`  ${author} in ${board}  ${votes}  ${replies}  ${chalk.dim(time)}`)
    if (post.body) {
      const preview = post.body.length > 120 ? post.body.slice(0, 120) + '...' : post.body
      console.log(`  ${chalk.dim(preview)}`)
    }
    console.log()
  }
}
