/**
 * Hippius Bittensor subnet adapter
 * ─────────────────────────────────────────────────────────────────────────────
 * Hippius is a decentralized IPFS-backed storage network running on Bittensor.
 * Files are uploaded to their IPFS node and served via their public gateway.
 *
 * npm:     hippius-sdk (v0.0.1, early alpha — JS SDK only takes file paths)
 * We use the raw IPFS HTTP API directly (supports Buffer natively).
 *
 * SETUP:
 *   1. Get your API credentials at https://hippius.com/account/api-keys
 *   2. Add to .env.local:
 *        HIPPIUS_STORE_URL=https://store.hippius.network     # upload endpoint
 *        HIPPIUS_GATEWAY_URL=https://get.hippius.network     # retrieval base
 *        HIPPIUS_API_KEY=<your-key>                          # optional; may be required
 *   3. In lib/storage/index.ts, swap `localAdapter` → `hippiusAdapter`
 *   4. For long-term persistence call pin() after upload (see below)
 *
 * GATEWAY URL format: https://get.hippius.network/ipfs/<CID>
 * ─────────────────────────────────────────────────────────────────────────────
 */
import FormData from 'form-data'
import type { StorageAdapter } from './adapter'

const STORE_URL  = process.env.HIPPIUS_STORE_URL   ?? 'https://store.hippius.network'
const GATEWAY    = process.env.HIPPIUS_GATEWAY_URL ?? 'https://get.hippius.network'
const API_KEY    = process.env.HIPPIUS_API_KEY

interface IpfsAddResult {
  Hash?: string
  cid?: string
  Name?: string
  Size?: string
}

export const hippiusAdapter: StorageAdapter = {
  async upload(buffer, filename, mimetype): Promise<string> {
    const form = new FormData()
    form.append('file', buffer, {
      filename,
      contentType: mimetype,
      knownLength: buffer.length,
    })

    const headers: Record<string, string> = {
      ...form.getHeaders(),
    }
    if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`

    const res = await fetch(`${STORE_URL}/api/v0/add`, {
      method: 'POST',
      // @ts-expect-error — form-data is node-compatible; Next.js edge won't need this
      body: form,
      headers,
    })

    if (!res.ok) {
      throw new Error(`Hippius upload failed: ${res.status} ${res.statusText}`)
    }

    const json = (await res.json()) as IpfsAddResult
    const cid = json.Hash ?? json.cid

    if (!cid) {
      throw new Error('Hippius upload: no CID returned')
    }

    // Optional: pin the file so it's not garbage-collected
    // This is a fire-and-forget; failure doesn't affect the returned URL.
    void fetch(`${STORE_URL}/api/v0/pin/add?arg=${cid}`, {
      method: 'POST',
      headers: API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {},
    }).catch((err: unknown) => {
      console.warn('[Hippius] pin failed for', cid, err)
    })

    return `${GATEWAY}/ipfs/${cid}`
  },
}
