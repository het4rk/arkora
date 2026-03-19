import chalk from 'chalk'
import { requireApiKey } from '../config.js'
import { api } from '../api.js'

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
    console.log(chalk.dim('No boards found.'))
    return
  }

  console.log()
  console.log(chalk.bold('Boards'))
  console.log()

  const maxLabel = Math.max(...boards.map((b) => b.label.length))
  for (const board of boards) {
    const label = board.label.padEnd(maxLabel + 2)
    const count = chalk.dim(`${board.postCount} posts`)
    console.log(`  ${chalk.cyan(label)} ${count}`)
  }
  console.log()
}
