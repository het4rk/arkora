import { config } from 'dotenv'
config({ path: '.env.local' })
import { neon } from '@neondatabase/serverless'

async function run() {
  const sql = neon(process.env['DATABASE_URL']!)
  const r = await sql`UPDATE posts SET board_id = 'arkora' WHERE board_id = 'agora'`
  console.log('Rows updated:', r.length)
}

run().catch(console.error)
