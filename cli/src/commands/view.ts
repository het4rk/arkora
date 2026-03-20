import chalk from 'chalk'
import { requireApiKey } from '../config.js'
import { api } from '../api.js'
import { accent, accentBold, dim, up, down, board, separator } from '../theme.js'

interface Reply {
  id: string
  body: string
  upvotes: number
  downvotes: number
  createdAt: string
  parentReplyId: string | null
  author: { handle: string | null }
}

interface Post {
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

interface PollResults {
  totalVotes: number
  options: Array<{ index: number; text: string; votes: number }>
}

interface ViewData {
  post: Post
  replies: Reply[]
  pollResults: PollResults | null
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export async function viewCommand(id: string): Promise<void> {
  const key = requireApiKey()
  const res = await api<ViewData>(`/posts/${id}`, key)
  const { post, replies, pollResults } = res.data!

  const author = post.author.handle ?? dim('anon')
  const time = timeAgo(post.createdAt)

  console.log()
  console.log(accentBold(post.title))
  console.log(`${author} in ${board(post.boardId)}  ${dim(time)}`)
  console.log(`${up(`+${post.upvotes}`)} ${down(`-${post.downvotes}`)}  ${dim(`${post.replyCount} replies`)}  ${dim(`${post.viewCount} views`)}`)
  if (post.body) {
    console.log()
    console.log(post.body)
  }

  // Poll results
  if (pollResults && pollResults.options.length > 0) {
    console.log()
    console.log(accentBold('Poll'))
    const total = pollResults.totalVotes || 1
    for (const opt of pollResults.options) {
      const pct = Math.round((opt.votes / total) * 100)
      const bar = accent('█'.repeat(Math.round(pct / 5)) || '░')
      console.log(`  ${bar} ${pct}%  ${opt.text} ${dim(`(${opt.votes})`)}`)
    }
    console.log(dim(`  ${pollResults.totalVotes} total votes`))
  }

  // Replies
  if (replies.length > 0) {
    console.log()
    console.log(separator())
    console.log(accentBold(`Replies (${replies.length})`))
    console.log()

    for (const reply of replies) {
      const rAuthor = reply.author.handle ?? dim('anon')
      const indent = reply.parentReplyId ? '    ' : '  '
      const prefix = reply.parentReplyId ? dim('└ ') : ''
      console.log(`${indent}${prefix}${rAuthor}  ${dim(timeAgo(reply.createdAt))}  ${up(`+${reply.upvotes}`)} ${down(`-${reply.downvotes}`)}`)
      console.log(`${indent}  ${reply.body.length > 200 ? reply.body.slice(0, 200) + '...' : reply.body}`)
      console.log()
    }
  }
}
