import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export async function GET() {
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
