import { describe, it, expect } from 'vitest'
import { generateDmKeyPair, encryptDm, decryptDm } from '@/lib/crypto/dm'

describe('generateDmKeyPair', () => {
  it('returns a private and public key in base64', () => {
    const { privateKeyB64, publicKeyB64 } = generateDmKeyPair()
    expect(typeof privateKeyB64).toBe('string')
    expect(typeof publicKeyB64).toBe('string')
    expect(privateKeyB64.length).toBeGreaterThan(0)
    expect(publicKeyB64.length).toBeGreaterThan(0)
  })

  it('generates unique key pairs each call', () => {
    const a = generateDmKeyPair()
    const b = generateDmKeyPair()
    expect(a.privateKeyB64).not.toBe(b.privateKeyB64)
    expect(a.publicKeyB64).not.toBe(b.publicKeyB64)
  })

  it('produces a 32-byte (44-char base64) x25519 key pair', () => {
    const { privateKeyB64, publicKeyB64 } = generateDmKeyPair()
    // 32 bytes → 44 chars in base64 (with padding)
    expect(Buffer.from(privateKeyB64, 'base64').length).toBe(32)
    expect(Buffer.from(publicKeyB64, 'base64').length).toBe(32)
  })
})

describe('encryptDm / decryptDm roundtrip', () => {
  it('encrypts and decrypts a message correctly', async () => {
    const alice = generateDmKeyPair()
    const bob = generateDmKeyPair()

    const plaintext = 'Hello, Bob!'
    const encrypted = await encryptDm(alice.privateKeyB64, bob.publicKeyB64, plaintext)
    const decrypted = await decryptDm(bob.privateKeyB64, alice.publicKeyB64, encrypted)

    expect(decrypted).toBe(plaintext)
  })

  it('produces different ciphertext each call (random nonce)', async () => {
    const alice = generateDmKeyPair()
    const bob = generateDmKeyPair()
    const plaintext = 'same message'

    const enc1 = await encryptDm(alice.privateKeyB64, bob.publicKeyB64, plaintext)
    const enc2 = await encryptDm(alice.privateKeyB64, bob.publicKeyB64, plaintext)

    expect(enc1.ciphertext).not.toBe(enc2.ciphertext)
    expect(enc1.nonce).not.toBe(enc2.nonce)
  })

  it('works symmetrically (bob can also send to alice)', async () => {
    const alice = generateDmKeyPair()
    const bob = generateDmKeyPair()

    const msg = 'Reply from Bob'
    const encrypted = await encryptDm(bob.privateKeyB64, alice.publicKeyB64, msg)
    const decrypted = await decryptDm(alice.privateKeyB64, bob.publicKeyB64, encrypted)

    expect(decrypted).toBe(msg)
  })

  it('encrypts empty string', async () => {
    const alice = generateDmKeyPair()
    const bob = generateDmKeyPair()

    const encrypted = await encryptDm(alice.privateKeyB64, bob.publicKeyB64, '')
    const decrypted = await decryptDm(bob.privateKeyB64, alice.publicKeyB64, encrypted)

    expect(decrypted).toBe('')
  })

  it('encrypts unicode and emoji', async () => {
    const alice = generateDmKeyPair()
    const bob = generateDmKeyPair()

    const plaintext = '🔐 Привет мир — こんにちは'
    const encrypted = await encryptDm(alice.privateKeyB64, bob.publicKeyB64, plaintext)
    const decrypted = await decryptDm(bob.privateKeyB64, alice.publicKeyB64, encrypted)

    expect(decrypted).toBe(plaintext)
  })

  it('fails to decrypt with a wrong private key', async () => {
    const alice = generateDmKeyPair()
    const bob = generateDmKeyPair()
    const eve = generateDmKeyPair()

    const encrypted = await encryptDm(alice.privateKeyB64, bob.publicKeyB64, 'secret')

    await expect(
      decryptDm(eve.privateKeyB64, alice.publicKeyB64, encrypted)
    ).rejects.toThrow()
  })

  it('ciphertext is a valid base64 string', async () => {
    const alice = generateDmKeyPair()
    const bob = generateDmKeyPair()

    const { ciphertext, nonce } = await encryptDm(alice.privateKeyB64, bob.publicKeyB64, 'test')

    expect(() => Buffer.from(ciphertext, 'base64')).not.toThrow()
    expect(() => Buffer.from(nonce, 'base64')).not.toThrow()
    // nonce is 12 bytes
    expect(Buffer.from(nonce, 'base64').length).toBe(12)
  })
})
