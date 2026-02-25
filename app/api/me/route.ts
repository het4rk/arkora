import { NextResponse } from 'next/server'
import { getCallerNullifier } from '@/lib/serverAuth'
import { getUserByNullifier } from '@/lib/db/users'

export async function GET() {
  const nullifierHash = await getCallerNullifier()
  if (!nullifierHash) {
    return NextResponse.json({ success: true, nullifierHash: null, user: null })
  }
  const user = await getUserByNullifier(nullifierHash)
  return NextResponse.json({ success: true, nullifierHash, user })
}
