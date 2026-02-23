/**
 * Active storage adapter.
 * Swap back to `localAdapter` for offline development without Hippius credentials.
 */
import { hippiusAdapter } from './hippius'
// import { localAdapter } from './local'

export const storage = hippiusAdapter
