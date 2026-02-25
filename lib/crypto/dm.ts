/**
 * Arkora DM Encryption
 *
 * Protocol: Curve25519 ECDH + HKDF-SHA256 → AES-256-GCM
 *
 * Security model:
 * - Server stores only ciphertext + public keys — cannot read messages
 * - Private key lives in Zustand persisted store (localStorage)
 * - Key material: ECDH shared point → HKDF stretch → AES-256 key
 * - Forward secrecy: NOT provided (same static key per conversation)
 *   → upgrade path: rotate keys periodically with ratchet
 */

import { x25519 } from '@noble/curves/ed25519.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'

// ── Encoding helpers ─────────────────────────────────────────────────────────

function toBase64(buf: Uint8Array): string {
  // Avoid spread (...buf) which overflows the JS call stack for large buffers
  return btoa(Array.from(buf, (b) => String.fromCharCode(b)).join(''))
}

function fromBase64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
}

// ── Key generation ────────────────────────────────────────────────────────────

export interface DmKeyPair {
  privateKeyB64: string  // base64, stored client-side only
  publicKeyB64: string   // base64, uploaded to server
}

export function generateDmKeyPair(): DmKeyPair {
  const privateKey = x25519.utils.randomSecretKey()
  const publicKey = x25519.getPublicKey(privateKey)
  return {
    privateKeyB64: toBase64(privateKey),
    publicKeyB64: toBase64(publicKey),
  }
}

// ── Shared secret derivation ──────────────────────────────────────────────────

function deriveSharedKey(myPrivateKeyB64: string, theirPublicKeyB64: string): Uint8Array {
  const myPrivate = fromBase64(myPrivateKeyB64)
  const theirPublic = fromBase64(theirPublicKeyB64)
  const sharedPoint = x25519.getSharedSecret(myPrivate, theirPublic)
  // HKDF stretches and domain-separates the raw DH output
  return hkdf(sha256, sharedPoint, undefined, new TextEncoder().encode('arkora-dm-v1'), 32)
}

// ── Encryption ────────────────────────────────────────────────────────────────

export interface EncryptedMessage {
  ciphertext: string  // base64
  nonce: string       // base64 12-byte GCM nonce
}

export async function encryptDm(
  myPrivateKeyB64: string,
  theirPublicKeyB64: string,
  plaintext: string
): Promise<EncryptedMessage> {
  const sharedKey = deriveSharedKey(myPrivateKeyB64, theirPublicKeyB64)
  const nonce = crypto.getRandomValues(new Uint8Array(12))

  const cryptoKey = await crypto.subtle.importKey(
    'raw', sharedKey as unknown as ArrayBuffer, { name: 'AES-GCM' }, false, ['encrypt']
  )
  const enc = new TextEncoder()
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    cryptoKey,
    enc.encode(plaintext) as unknown as ArrayBuffer
  )
  return {
    ciphertext: toBase64(new Uint8Array(ciphertextBuf)),
    nonce: toBase64(nonce),
  }
}

// ── Decryption ────────────────────────────────────────────────────────────────

export async function decryptDm(
  myPrivateKeyB64: string,
  theirPublicKeyB64: string,
  encrypted: EncryptedMessage
): Promise<string> {
  const sharedKey = deriveSharedKey(myPrivateKeyB64, theirPublicKeyB64)
  const cryptoKey = await crypto.subtle.importKey(
    'raw', sharedKey as unknown as ArrayBuffer, { name: 'AES-GCM' }, false, ['decrypt']
  )
  const ciphertextBuf = fromBase64(encrypted.ciphertext)
  const nonceBuf = fromBase64(encrypted.nonce)
  const plaintextBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonceBuf as unknown as ArrayBuffer },
    cryptoKey,
    ciphertextBuf as unknown as ArrayBuffer
  )
  return new TextDecoder().decode(plaintextBuf)
}
