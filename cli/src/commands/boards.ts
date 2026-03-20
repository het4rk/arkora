import { requireApiKey } from '../config.js'
import { api } from '../api.js'
import { accentBold, dim, board } from '../theme.js'

interface Board {
  id: string
  label: string
  postCount: number
}

export async function boardsCommand(): Promise<void> {
  const key = requireApiKey()
  const res = await api<Board[]>('/boards', key)
  const boards = res.data ?? []

  if (boards.length === 0) {
    console.log(dim('No boards found.'))
    return
  }

  console.log()
  console.log(accentBold('Boards'))
  console.log()

  const maxLabel = Math.max(...boards.map((b) => b.label.length))
  for (const b of boards) {
    const label = b.label.padEnd(maxLabel + 2)
    const count = dim(`${b.postCount} posts`)
    console.log(`  ${board(b.id).padEnd(maxLabel + 12)} ${label} ${count}`)
  }
  console.log()
}
