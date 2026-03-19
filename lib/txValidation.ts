/** Validates a World Chain transaction hash: 0x + 64 hex characters. */
const TX_ID_RE = /^0x[0-9a-fA-F]{64}$/

export function isValidTxId(txId: string): boolean {
  return TX_ID_RE.test(txId)
}
