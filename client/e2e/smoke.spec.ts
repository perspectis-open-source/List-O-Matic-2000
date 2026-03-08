import { test, expect } from '@playwright/test'

test.describe('Smoke', () => {
  test('app loads and shows get started or main content', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/List-O-Matic 2000/)
    await expect(page.getByTestId('main-content')).toBeVisible()
    const uploadTrigger = page.getByTestId('upload-trigger')
    await expect(uploadTrigger).toBeVisible()
  })
})
