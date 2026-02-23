/**
 * Seed script — inserts a mock verified user and post, then reads it back.
 * Run: pnpm db:seed
 *
 * Requires DATABASE_URL in .env.local
 */

import 'dotenv/config'
import { db } from '../lib/db/index'
import { humanUsers, posts } from '../lib/db/schema'

async function seed() {
  console.log('🌱 Seeding database...')

  const nullifierHash = '0x' + '1'.repeat(64)
  const walletAddress = '0x' + '2'.repeat(40)

  // 1. Create a verified human user
  await db
    .insert(humanUsers)
    .values({ nullifierHash, walletAddress })
    .onConflictDoNothing()

  console.log('✅ Created human user:', nullifierHash)

  // 2. Create a test post
  const [post] = await db
    .insert(posts)
    .values({
      title: 'Welcome to Arkora — provably human message board',
      body: 'Every voice here is cryptographically guaranteed to be a real, unique human. No bots. No spam. Just humans.',
      boardId: 'agora',
      nullifierHash,
      sessionTag: 'Human #1337',
    })
    .returning()

  if (!post) throw new Error('Failed to insert post')
  console.log('✅ Created post:', post.id)

  // 3. Read it back
  const result = await db.select().from(posts)
  console.log('📖 Posts in DB:', result.length)
  console.log('First post title:', result[0]?.title)

  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
