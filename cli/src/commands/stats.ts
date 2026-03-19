import chalk from 'chalk'
import { requireApiKey } from '../config.js'
import { api } from '../api.js'

interface Stats {
  totalPosts: number
  totalReplies: number
  totalUsers: number
  totalVotes: number
  totalBoards: number
  postsToday: number
}

export async function statsCommand(): Promise<void> {
  const key = requireApiKey()
  const res = await api<Stats>('/stats', key)
  const stats = res.data!

  console.log()
  console.log(chalk.bold('Arkora Stats'))
  console.log()
  console.log(`  Posts:     ${chalk.green(stats.totalPosts.toLocaleString())}`)
  console.log(`  Replies:   ${chalk.green(stats.totalReplies.toLocaleString())}`)
  console.log(`  Users:     ${chalk.green(stats.totalUsers.toLocaleString())}`)
  console.log(`  Votes:     ${chalk.green(stats.totalVotes.toLocaleString())}`)
  console.log(`  Boards:    ${chalk.green(stats.totalBoards.toLocaleString())}`)
  console.log(`  Today:     ${chalk.yellow(stats.postsToday.toLocaleString())} posts`)
  console.log()
}
