/**
 * Active storage adapter.
 * Swap `localAdapter` → `hippiusAdapter` when ready to go decentralized.
 */
import { localAdapter } from './local'
// import { hippiusAdapter } from './hippius'  ← uncomment when ready

export const storage = localAdapter
