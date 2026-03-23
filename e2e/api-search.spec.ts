import { test, expect } from '@playwright/test'

test.describe('GET /api/search', () => {
  test('returns 200 with results shape for query', async ({ request }) => {
    const res = await request.get('/api/search?q=test')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty('boards')
    expect(body.data).toHaveProperty('people')
    expect(body.data).toHaveProperty('posts')
    expect(Array.isArray(body.data.boards)).toBe(true)
    expect(Array.isArray(body.data.people)).toBe(true)
    expect(Array.isArray(body.data.posts)).toBe(true)
  })

  test('empty query returns empty results, not error', async ({ request }) => {
    const res = await request.get('/api/search?q=')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.boards).toEqual([])
    expect(body.data.people).toEqual([])
    expect(body.data.posts).toEqual([])
  })
})
