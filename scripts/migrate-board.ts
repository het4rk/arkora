import { config } from 'dotenv'
config({ path: '.env.local' })
import postgres from 'postgres'

async function run() {
  const sql = postgres(process.env['DATABASE_URL']!)
  const r = await sql`UPDATE posts SET board_id = 'arkora' WHERE board_id = 'agora'`
  console.log('✅ Rows updated:', r.count)
  await sql.end()
}

run().catch(console.error)
