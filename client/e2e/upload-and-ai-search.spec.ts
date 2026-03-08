/**
 * @file upload-and-ai-search.spec.ts
 * @description Playwright E2E: upload CSV, AI Search with mocked API, export, remove records, persisted results.
 * @module List-O-Matic-2000/client/e2e
 */
import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const mockChatResponse = {
  matchingCompanyNames: ['Acme Inc'],
  parentCompany: 'Acme Corp',
  reasoningSteps: [],
}

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
    await page.getByRole('option', { name: 'Acme Inc' }).click()

    await expect(page.getByTestId('ai-search-button')).toBeEnabled()

    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockChatResponse),
      })
    })

    await page.getByTestId('ai-search-button').click()

    await expect(page.getByRole('tab', { name: 'AI Results' })).toBeVisible()
    await page.getByRole('tab', { name: 'AI Results' }).click()
    await expect(page.getByText(/contacts matching your search/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('export-results-button')).toBeVisible()
  })

  test('Contacts tab shows Export list button after upload', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('upload-trigger').click()
    const fileInput = page.getByRole('dialog').locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'sample-contacts.csv'))
    await expect(page.getByTestId('main-content')).toContainText('3 rows')
    await expect(page.getByTestId('tab-contacts')).toBeVisible()
    await expect(page.getByTestId('export-import-list-button')).toBeVisible()
    await expect(page.getByTestId('export-import-list-button')).toContainText('Export list')
  })

  test('Remove records from Import List removes rows and AI results persist when switching back', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByTestId('upload-trigger').click()
    const fileInput = page.getByRole('dialog').locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'sample-contacts.csv'))
    await expect(page.getByTestId('main-content')).toContainText('3 rows')

    await page.getByTestId('company-select-input').click()
    await page.getByRole('option', { name: 'Acme Inc' }).click()
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockChatResponse),
      })
    })
    await page.getByTestId('ai-search-button').click()

    await expect(page.getByRole('tab', { name: 'AI Results' })).toBeVisible({ timeout: 10000 })
    await page.getByRole('tab', { name: 'AI Results' }).click()
    await expect(page.getByText(/2 contacts matching your search/)).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('remove-from-import-button')).toBeVisible()
    await expect(page.getByTestId('remove-from-import-button')).toContainText('Remove records from Import List')

    await page.getByTestId('remove-from-import-button').click()

    await expect(page.getByRole('tab', { name: 'Contacts' })).toBeVisible()
    await expect(page.getByTestId('main-content')).toContainText('1 row')

    await page.getByRole('tab', { name: 'AI Results' }).click()
    await expect(page.getByText(/2 contacts matching your search/)).toBeVisible()
    await expect(page.getByTestId('export-results-button')).toBeVisible()
  })

  test('LLM search dialog shows warning during search', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('upload-trigger').click()
    const fileInput = page.getByRole('dialog').locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'sample-contacts.csv'))
    await page.getByTestId('company-select-input').click()
    await page.getByRole('option', { name: 'Acme Inc' }).click()

    let resolveFulfill: () => void
    const fulfillPromise = new Promise<void>((resolve) => {
      resolveFulfill = resolve
    })
    await page.route('**/api/chat', async (route) => {
      await fulfillPromise
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockChatResponse),
      })
    })

    await page.getByTestId('ai-search-button').click()
    const dialog = page.getByTestId('llm-search-dialog')
    await expect(dialog).toBeVisible({ timeout: 3000 })
    await expect(dialog.getByText(/This data .* computed by an LLM/)).toBeVisible()
    await expect(dialog.getByText(/may be inaccurate or incomplete/)).toBeVisible()
    resolveFulfill!()
    await expect(page.getByRole('tab', { name: 'AI Results' })).toBeVisible({ timeout: 10000 })
  })
})
