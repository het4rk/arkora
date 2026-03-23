import { test, expect } from '@playwright/test'

test.describe('GET /api/posts', () => {
  test('returns 200 with success true and data array', async ({ request }) => {
    const res = await request.get('/api/posts')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
  })

  test('posts have expected shape', async ({ request }) => {
    const res = await request.get('/api/posts')
    const body = await res.json()

    if (body.data.length > 0) {
      const post = body.data[0]
      expect(post).toHaveProperty('id')
      expect(post).toHaveProperty('title')
      expect(post).toHaveProperty('body')
      expect(post).toHaveProperty('upvotes')
      expect(post).toHaveProperty('downvotes')
    }
  })

  test('respects limit parameter', async ({ request }) => {
    const res = await request.get('/api/posts?limit=2')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.length).toBeLessThanOrEqual(2)
  })
})
