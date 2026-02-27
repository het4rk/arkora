/**
 * StorageAdapter - pluggable image/file storage interface.
 *
 * Current adapter: local-disk (dev/free, stores in /public/uploads)
 * Next adapter:    Hippius Bittensor subnet (see hippius.ts)
 *
 * To swap adapters, change the export in lib/storage/index.ts.
 */
export interface StorageAdapter {
  /**
   * Upload a file buffer and return a publicly accessible URL.
   * @param buffer   Raw file bytes
   * @param filename Original filename (used for extension)
   * @param mimetype e.g. "image/jpeg", "image/gif", "image/webp"
   */
  upload(buffer: Buffer, filename: string, mimetype: string): Promise<string>
}
