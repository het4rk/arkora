import { test, expect } from '@playwright/test'

test.describe('Homepage / Feed', () => {
  test('page loads and title contains Arkora', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Arkora/i)
  })

  test('feed container is visible', async ({ page }) => {
    await page.goto('/')
    // Wait for the page to hydrate - look for main content area
    const main = page.locator('main').first()
    await expect(main).toBeVisible({ timeout: 10000 })
  })

  test('homepage loads without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    expect(errors).toEqual([])
  })
})
