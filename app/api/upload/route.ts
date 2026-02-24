import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage'

const MAX_SIZE_BYTES = 8 * 1024 * 1024 // 8 MB
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
])

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Only JPEG, PNG, GIF, and WebP are allowed' },
        { status: 415 }
      )
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: 'File exceeds 8 MB limit' },
        { status: 413 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    // Strip path separators and control characters to prevent path traversal
    const safeName = file.name.replace(/[/\\?%*:|"<>\x00-\x1f]/g, '_')
    const url = await storage.upload(buffer, safeName, file.type)

    return NextResponse.json({ success: true, url })
  } catch (err) {
    console.error('[upload POST]', err)
    return NextResponse.json(
      { success: false, error: 'Upload failed' },
      { status: 500 }
    )
  }
}
