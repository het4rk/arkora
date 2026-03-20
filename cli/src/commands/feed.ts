import chalk from 'chalk'
import { requireApiKey } from '../config.js'
import { api } from '../api.js'
import { accentBold, dim, up, down, board } from '../theme.js'

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
    console.log(dim('No posts found.'))
    return
  }

  console.log()
  for (const post of posts) {
    const author = post.author.handle ?? dim('anon')
    const votes = up(`+${post.upvotes}`) + '/' + down(`-${post.downvotes}`)
    const replies = dim(`${post.replyCount} replies`)
    const time = new Date(post.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    console.log(`${accentBold(post.title)}  ${dim(post.id.slice(0, 8))}`)
    console.log(`  ${author} in ${board(post.boardId)}  ${votes}  ${replies}  ${dim(time)}`)
    if (post.body) {
      const preview = post.body.length > 120 ? post.body.slice(0, 120) + '...' : post.body
      console.log(`  ${dim(preview)}`)
    }
    console.log()
  }
}
