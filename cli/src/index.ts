#!/usr/bin/env node
import { Command } from 'commander'
import { loginCommand } from './commands/login.js'
import { feedCommand } from './commands/feed.js'
import { postCommand } from './commands/post.js'
import { boardsCommand } from './commands/boards.js'
import { statsCommand } from './commands/stats.js'
import { viewCommand } from './commands/view.js'
import { replyCommand } from './commands/reply.js'
import { voteCommand } from './commands/vote.js'
import { searchCommand } from './commands/search.js'
import { notificationsCommand } from './commands/notifications.js'
import { meCommand } from './commands/me.js'
import { getConfig } from './config.js'
import { setAccent } from './theme.js'

// Load saved skin from config
const config = getConfig()
if (config.skinId) {
  setAccent(config.skinId, config.customHex)
}

const program = new Command()

program
  .name('arkora')
  .description('CLI for Arkora - the provably human message board')
  .version('2.0.0')

program
  .command('login')
  .description('Verify with World ID and authenticate')
  .action(loginCommand)

program
  .command('me')
  .description('Show your profile')
  .action(meCommand)

program
  .command('feed')
  .description('Browse recent posts')
  .option('-b, --board <id>', 'Filter by board slug')
  .option('-l, --limit <n>', 'Number of posts (1-50)', '20')
  .action(feedCommand)

program
  .command('view <id>')
  .description('View a post with replies')
  .action(viewCommand)

program
  .command('post <title>')
  .description('Create a new post')
  .option('--body <text>', 'Post body text')
  .option('-b, --board <id>', 'Board to post in', 'arkora')
  .action(postCommand)

program
  .command('reply <postId>')
  .description('Reply to a post')
  .option('--body <text>', 'Reply text')
  .action(replyCommand)

program
  .command('vote <postId>')
  .description('Vote on a post')
  .option('-u, --up', 'Upvote')
  .option('-d, --down', 'Downvote')
  .option('--undo', 'Remove vote')
  .action(voteCommand)

program
  .command('search <query>')
  .description('Search posts, boards, and people')
  .option('-t, --type <type>', 'Filter: all, posts, boards, people', 'all')
  .action(searchCommand)

program
  .command('notifications')
  .alias('notifs')
  .description('View notifications')
  .option('-r, --read', 'Mark all as read')
  .action(notificationsCommand)

program
  .command('boards')
  .description('List all boards')
  .action(boardsCommand)

program
  .command('stats')
  .description('Platform stats')
  .action(statsCommand)

program.parse()
