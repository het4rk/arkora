import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage'
import { getCallerNullifier } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'

const MAX_SIZE_BYTES = 8 * 1024 * 1024 // 8 MB
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
])

function validateMagicBytes(buf: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg')
    return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF
  if (mimeType === 'image/png')
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47
  if (mimeType === 'image/gif')
    return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46
  if (mimeType === 'image/webp')
    return buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
  return false
}

/**
 * Strip EXIF/metadata from JPEG files to protect user privacy.
 * Removes APP1 (EXIF), APP2 (ICC profile), and comment markers.
 * Non-JPEG files pass through unchanged.
 */
function stripExif(buf: Buffer): Buffer {
  // Only process JPEG (starts with FF D8)
  if (buf[0] !== 0xFF || buf[1] !== 0xD8) return buf

  const clean: Buffer[] = [Buffer.from([0xFF, 0xD8])]
  let i = 2
  while (i < buf.length - 1) {
    if (buf[i] !== 0xFF) break
    const marker = buf[i + 1]!
    // APP1 (EXIF), APP2 (ICC), COM (comments) - skip these segments
    if (marker === 0xE1 || marker === 0xE2 || marker === 0xFE) {
      if (i + 3 >= buf.length) break
      const segLen = (buf[i + 2]! << 8) | buf[i + 3]!
      i += 2 + segLen
      continue
    }
    // SOS (start of scan) - rest is image data, keep everything
    if (marker === 0xDA) {
      clean.push(buf.subarray(i))
      return Buffer.concat(clean)
    }
    // Keep all other markers (DQT, DHT, SOF, APP0/JFIF, etc.)
    if (i + 3 < buf.length) {
      const segLen = (buf[i + 2]! << 8) | buf[i + 3]!
      clean.push(buf.subarray(i, i + 2 + segLen))
      i += 2 + segLen
    } else {
      break
    }
  }
  return Buffer.concat(clean)
}

export async function POST(req: NextRequest) {
  try {
    const nullifierHash = await getCallerNullifier()
    if (!nullifierHash) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit: 10 uploads per minute
    if (!rateLimit(`upload:${nullifierHash}`, 10, 60_000)) {
      return NextResponse.json({ success: false, error: 'Too many uploads' }, { status: 429 })
    }

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

    const rawBuffer = Buffer.from(await file.arrayBuffer())

    // Validate magic bytes - file.type is client-supplied and can be spoofed
    if (!validateMagicBytes(rawBuffer, file.type)) {
      return NextResponse.json(
        { success: false, error: 'File content does not match declared type' },
        { status: 400 }
      )
    }

    // Strip EXIF metadata from JPEG to protect user privacy (GPS coords, device info, etc.)
    const buffer = stripExif(rawBuffer)
    // Strip path separators and control characters to prevent path traversal
    const safeName = file.name.replace(/[/\\?%*:|"<>\x00-\x1f]/g, '_')
    const url = await storage.upload(buffer, safeName, file.type)

    return NextResponse.json({ success: true, url })
  } catch (err) {
    console.error('[upload POST]', err instanceof Error ? err.message : String(err))
    return NextResponse.json(
      { success: false, error: 'Upload failed' },
      { status: 500 }
    )
  }
}
