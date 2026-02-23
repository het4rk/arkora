/**
 * Local disk adapter — stores uploads in /public/uploads/
 * Files are served by Next.js at /uploads/<filename>
 *
 * ✅ Free, zero-config, works in dev and on any VPS
 * ❌ Not suitable for serverless (Vercel) — files don't persist across deploys.
 *    For serverless, swap to the Hippius adapter or another object store.
 */
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import type { StorageAdapter } from './adapter'

function ext(filename: string, mimetype: string): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
  }
  return mimeMap[mimetype] ?? path.extname(filename) ?? '.bin'
}

export const localAdapter: StorageAdapter = {
  async upload(buffer, filename, mimetype) {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadDir, { recursive: true })

    const name = `${randomUUID()}${ext(filename, mimetype)}`
    const fullPath = path.join(uploadDir, name)
    await writeFile(fullPath, buffer)

    return `/uploads/${name}`
  },
}
