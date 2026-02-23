/**
 * Hippius Bittensor subnet — S3-compatible adapter
 * ─────────────────────────────────────────────────────────────────────────────
 * Hippius runs S3-compatible object storage on top of the Bittensor network.
 *
 * Endpoint:  https://s3.hippius.com
 * Region:    "decentralized"  (constant regardless of location)
 * Console:   https://console.hippius.com
 *
 * SETUP:
 *   1. Create a bucket at https://console.hippius.com/dashboard/storage
 *   2. Set the bucket to public (or configure ACL per object)
 *   3. Add to .env.local:
 *        HIPPIUS_ACCESS_KEY_ID=hip_...
 *        HIPPIUS_SECRET_ACCESS_KEY=...
 *        HIPPIUS_BUCKET=arkora-uploads          # your bucket name
 *        HIPPIUS_S3_ENDPOINT=https://s3.hippius.com   # default
 *        HIPPIUS_PUBLIC_URL=https://s3.hippius.com    # base for public URLs
 *   4. In lib/storage/index.ts, swap `localAdapter` → `hippiusAdapter`
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import type { StorageAdapter } from './adapter'

const ENDPOINT   = process.env.HIPPIUS_S3_ENDPOINT    ?? 'https://s3.hippius.com'
const BUCKET     = process.env.HIPPIUS_BUCKET          ?? 'arkora-uploads'
const PUBLIC_URL = process.env.HIPPIUS_PUBLIC_URL      ?? ENDPOINT
const ACCESS_KEY = process.env.HIPPIUS_ACCESS_KEY_ID   ?? ''
const SECRET_KEY = process.env.HIPPIUS_SECRET_ACCESS_KEY ?? ''

const s3 = new S3Client({
  region: 'decentralized',
  endpoint: ENDPOINT,
  forcePathStyle: true, // required for non-AWS S3-compatible services
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
})

export const hippiusAdapter: StorageAdapter = {
  async upload(buffer, filename, mimetype): Promise<string> {
    // Prefix with timestamp to avoid collisions
    const key = `uploads/${Date.now()}-${filename}`

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
        ACL: 'public-read',
      })
    )

    // Path-style URL: https://s3.hippius.com/<bucket>/<key>
    return `${PUBLIC_URL}/${BUCKET}/${key}`
  },
}
