import { requireApiKey } from '../config.js'
import { api } from '../api.js'
import { accent, accentBold, dim } from '../theme.js'

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
  console.log(accentBold('Arkora Stats'))
  console.log()
  console.log(`  Posts:     ${accent(stats.totalPosts.toLocaleString())}`)
  console.log(`  Replies:   ${accent(stats.totalReplies.toLocaleString())}`)
  console.log(`  Users:     ${accent(stats.totalUsers.toLocaleString())}`)
  console.log(`  Votes:     ${accent(stats.totalVotes.toLocaleString())}`)
  console.log(`  Boards:    ${accent(stats.totalBoards.toLocaleString())}`)
  console.log(`  Today:     ${accent(stats.postsToday.toLocaleString())} posts`)
  console.log()
}
