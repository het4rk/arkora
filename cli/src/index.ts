#!/usr/bin/env node
import { Command } from 'commander'
import { loginCommand } from './commands/login.js'
import { feedCommand } from './commands/feed.js'
import { postCommand } from './commands/post.js'
import { boardsCommand } from './commands/boards.js'
import { statsCommand } from './commands/stats.js'

const program = new Command()

program
  .name('arkora')
  .description('CLI for Arkora - the provably human message board')
  .version('1.0.0')

program
  .command('login')
  .description('Authenticate with your Arkora API key')
  .action(loginCommand)

program
  .command('feed')
  .description('Show recent posts')
  .option('-b, --board <id>', 'Filter by board slug')
  .option('-l, --limit <n>', 'Number of posts (1-50)', '20')
  .action(feedCommand)

program
  .command('post <title>')
  .description('Create a new post')
  .option('--body <text>', 'Post body text')
  .option('-b, --board <id>', 'Board to post in', 'arkora')
  .action(postCommand)

program
  .command('boards')
  .description('List all boards with post counts')
  .action(boardsCommand)

program
  .command('stats')
  .description('Show platform aggregate stats')
  .action(statsCommand)

program.parse()
