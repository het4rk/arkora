import { test, expect } from '@playwright/test'

test.describe('GET /api/boards', () => {
  test('returns 200 with board list', async ({ request }) => {
    const res = await request.get('/api/boards')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBeGreaterThan(0)
  })

  test('boards have id and postCount fields', async ({ request }) => {
    const res = await request.get('/api/boards')
    const body = await res.json()

    const board = body.data[0]
    expect(board).toHaveProperty('id')
    expect(board).toHaveProperty('postCount')
    expect(typeof board.postCount).toBe('number')
  })
})
