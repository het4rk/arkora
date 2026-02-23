/**
 * Hippius Bittensor subnet adapter
 * ─────────────────────────────────────────────────────────────────────────────
 * Hippius is a decentralized storage subnet on Bittensor that provides
 * censorship-resistant, distributed object storage backed by miners.
 *
 * Docs: https://docs.hippius.com
 * npm:  https://www.npmjs.com/package/@hippius/sdk  (or the current package name)
 *
 * TO ACTIVATE:
 *   1. `pnpm add @hippius/sdk`  (check npm for latest package name)
 *   2. Add HIPPIUS_API_KEY to .env.local (get from Hippius dashboard / validator)
 *   3. Implement the upload() method below using the SDK
 *   4. In lib/storage/index.ts, swap `localAdapter` → `hippiusAdapter`
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { StorageAdapter } from './adapter'

export const hippiusAdapter: StorageAdapter = {
  async upload(buffer, filename, mimetype): Promise<string> {
    // TODO: implement when connecting to Hippius subnet
    //
    // const { HippiusClient } = await import('@hippius/sdk')
    // const client = new HippiusClient({ apiKey: process.env.HIPPIUS_API_KEY! })
    //
    // const result = await client.upload({
    //   data: buffer,
    //   filename,
    //   contentType: mimetype,
    // })
    //
    // return result.url   // e.g. https://gateway.hippius.com/ipfs/<cid>

    void buffer; void filename; void mimetype
    throw new Error(
      '[Hippius] Adapter not yet connected. ' +
      'See lib/storage/hippius.ts for setup instructions.'
    )
  },
}
