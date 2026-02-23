import { NextRequest, NextResponse } from 'next/server'
import { type ISuccessResult } from '@worldcoin/minikit-js'
import { verifyWorldIdProof } from '@/lib/worldid'
import { getOrCreateUser } from '@/lib/db/users'

interface RequestBody {
  payload: ISuccessResult
  action: string
  walletAddress: string
  signal?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody
    const { payload, action, walletAddress, signal } = body

    if (!payload || !action || !walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const result = await verifyWorldIdProof(payload, action, signal)

    if (!result.success || !result.nullifierHash) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Verification failed' },
        { status: 400 }
      )
    }

    // Upsert user — idempotent, safe to call multiple times
    const user = await getOrCreateUser(result.nullifierHash, walletAddress)

    return NextResponse.json({
      success: true,
      nullifierHash: result.nullifierHash,
      user,
    })
  } catch (err) {
    console.error('[verify/route]', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
