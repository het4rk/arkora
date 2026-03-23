import { NextResponse, type NextRequest } from 'next/server'

const MAX_JSON_SIZE = 1 * 1024 * 1024  // 1MB for JSON endpoints
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024  // 10MB for upload endpoint

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const contentLength = req.headers.get('content-length')

  // Reject oversized payloads early at the edge
  if (contentLength) {
    const size = parseInt(contentLength, 10)
    const isUpload = pathname === '/api/upload'
    const limit = isUpload ? MAX_UPLOAD_SIZE : MAX_JSON_SIZE

    if (size > limit) {
      return NextResponse.json(
        { success: false, error: 'Payload too large' },
        { status: 413 }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
