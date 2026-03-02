import { test, expect } from '@playwright/test'

test.describe('Smoke', () => {
  test('app loads', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Vite/)
  })
})
