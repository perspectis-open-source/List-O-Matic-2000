import { test, expect } from '@playwright/test'
import path from 'path'

test.describe('Upload and AI Search flow', () => {
  test('upload CSV and see contacts; AI Search with mocked API shows results', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(page.getByTestId('upload-trigger')).toBeVisible()
    await page.getByTestId('upload-trigger').click()

    const fileInput = page.getByRole('dialog').locator('input[type="file"]')
    await expect(fileInput).toBeVisible()
    const fixturePath = path.join(__dirname, 'fixtures', 'sample-contacts.csv')
    await fileInput.setInputFiles(fixturePath)

    await expect(page.getByTestId('main-content')).toContainText('sample-contacts.csv')
    await expect(page.getByTestId('main-content')).toContainText('3 rows')

    await expect(page.getByTestId('company-select-input')).toBeVisible()
    await page.getByTestId('company-select-input').click()
    await page.getByText('Acme Inc', { exact: true }).click()

    await expect(page.getByTestId('ai-search-button')).toBeEnabled()

    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          matchingCompanyNames: ['Acme Inc'],
          parentCompany: 'Acme Corp',
          reasoningSteps: [],
        }),
      })
    })

    await page.getByTestId('ai-search-button').click()

    await expect(page.getByRole('tab', { name: 'AI Results' })).toBeVisible()
    await page.getByRole('tab', { name: 'AI Results' }).click()
    await expect(page.getByText(/contacts matching your search/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('export-results-button')).toBeVisible()
  })
})
