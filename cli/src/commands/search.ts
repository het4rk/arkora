import chalk from 'chalk'
import { requireApiKey } from '../config.js'
import { api } from '../api.js'
import { accent, accentBold, dim, up, down, board } from '../theme.js'

interface SearchResults {
  boards: Array<{ id: string; label: string; postCount: number }>
  people: Array<{ pseudoHandle: string | null; nullifierHash: string }>
  posts: Array<{
    id: string
    title: string
    body: string
    boardId: string
    upvotes: number
    downvotes: number
    createdAt: string
    author: { handle: string | null }
  }>
}

export async function searchCommand(
  query: string,
  options: { type?: string }
): Promise<void> {
  const key = requireApiKey()

  const params = new URLSearchParams({ q: query })
  if (options.type) params.set('type', options.type)

  const res = await api<SearchResults>(`/search?${params}`, key)
  const data = res.data!

  const hasResults =
    data.boards.length > 0 || data.people.length > 0 || data.posts.length > 0

  if (!hasResults) {
    console.log(dim('No results found.'))
    return
  }

  console.log()

  if (data.boards.length > 0) {
    console.log(accentBold('Boards'))
    for (const b of data.boards) {
      console.log(`  ${board(b.id)}  ${b.label}  ${dim(`${b.postCount} posts`)}`)
    }
    console.log()
  }

  if (data.people.length > 0) {
    console.log(accentBold('People'))
    for (const p of data.people) {
      console.log(`  ${accent(p.pseudoHandle ?? 'anon')}`)
    }
    console.log()
  }

  if (data.posts.length > 0) {
    console.log(accentBold('Posts'))
    for (const p of data.posts) {
      const author = p.author.handle ?? dim('anon')
      console.log(`  ${chalk.bold(p.title)}`)
      console.log(`    ${author} in ${board(p.boardId)}  ${up(`+${p.upvotes}`)} ${down(`-${p.downvotes}`)}  ${dim(p.id)}`)
      if (p.body) {
        const preview = p.body.length > 100 ? p.body.slice(0, 100) + '...' : p.body
        console.log(`    ${dim(preview)}`)
      }
      console.log()
    }
  }
}
