import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { rateLimit } from '@/lib/rateLimit'

const HEALTH_TIMEOUT = 5000

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'anon'
  if (!(await rateLimit(`health:${ip}`, 10, 60_000))) {
    return NextResponse.json({ status: 'rate-limited' }, { status: 429 })
  }

  try {
    const checks = await Promise.race([
      Promise.allSettled([
        db.execute(sql`SELECT 1`),
        checkRedis(),
      ]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), HEALTH_TIMEOUT)
      ),
    ])

    const dbOk = checks[0].status === 'fulfilled'
    const redisOk = checks[1].status === 'fulfilled' ? checks[1].value : null
    const allOk = dbOk && (redisOk === null || redisOk === true)

    return NextResponse.json(
      { status: allOk ? 'ok' : 'degraded', db: dbOk, redis: redisOk, ts: Date.now() },
      { status: allOk ? 200 : 503 }
    )
  } catch {
    return NextResponse.json(
      { status: 'error', db: false, redis: null, ts: Date.now() },
      { status: 503 }
    )
  }
}

async function checkRedis(): Promise<boolean | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null // Redis not configured
  const res = await fetch(`${url}/ping`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.ok
}
