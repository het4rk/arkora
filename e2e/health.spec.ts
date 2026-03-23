import { test, expect } from '@playwright/test'

test.describe('GET /api/health', () => {
  test('returns 200 with status ok and db true', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.db).toBe(true)
    expect(body).toHaveProperty('ts')
  })
})
