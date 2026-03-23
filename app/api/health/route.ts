import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { rateLimit } from '@/lib/rateLimit'

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'anon'
  if (!(await rateLimit(`health:${ip}`, 10, 60_000))) {
    return NextResponse.json({ status: 'rate-limited' }, { status: 429 })
  }
  try {
    await db.execute(sql`SELECT 1`)
    return NextResponse.json({ status: 'ok', db: true, ts: Date.now() })
  } catch {
    return NextResponse.json(
      { status: 'error', db: false, ts: Date.now() },
      { status: 503 }
    )
  }
}
