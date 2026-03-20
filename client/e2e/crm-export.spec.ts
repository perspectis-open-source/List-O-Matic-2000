/**
 * @file crm-export.spec.ts
 * @description Playwright E2E tests for CRM export: enabled flow (dialog, mapping, export) and
 * disabled flow (button hidden). Mocks /api/chat, /api/crm/status, and /api/crm/export.
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

const mockCrmExportSuccess = {
  totalSent: 2,
  created: 1,
  updated: 1,
  failed: 0,
  errors: [],
}

const mockCrmExportPartialFailure = {
  totalSent: 2,
  created: 0,
  updated: 1,
  failed: 1,
  errors: [{ email: 'alice@acme.com', error: '400: Invalid email format' }],
}

async function uploadAndSearch(page: import('@playwright/test').Page, crmEnabled: boolean) {
  await page.route('**/api/crm/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ enabled: crmEnabled }),
    })
  })

  await page.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockChatResponse),
    })
  })

  await page.goto('/')
  await page.getByTestId('upload-trigger').click()
  const fileInput = page.getByRole('dialog').locator('input[type="file"]')
  await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'sample-contacts.csv'))
  await expect(page.getByTestId('main-content')).toContainText('3 rows')

  await page.getByTestId('company-select-input').click()
  await page.getByRole('option', { name: 'Acme Inc' }).click()
  await page.getByTestId('ai-search-button').click()

  await expect(page.getByRole('tab', { name: 'AI Results' })).toBeVisible({ timeout: 10000 })
  await page.getByRole('tab', { name: 'AI Results' }).click()
  await expect(page.getByText(/contacts matching your search/)).toBeVisible({ timeout: 10000 })
}

test.describe('CRM Export — enabled flow', () => {
  test('shows Export to CRM button and opens dialog', async ({ page }) => {
    await uploadAndSearch(page, true)

    const crmButton = page.getByTestId('crm-export-trigger')
    await expect(crmButton).toBeVisible({ timeout: 5000 })
    await crmButton.click()

    const dialog = page.getByTestId('crm-export-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('crm-export-disclaimer')).toBeVisible()
    await expect(dialog.getByText('Field Mapping')).toBeVisible()
  })

  test('exports successfully and shows summary', async ({ page }) => {
    await uploadAndSearch(page, true)

    await page.route('**/api/crm/export', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCrmExportSuccess),
      })
    })

    await page.getByTestId('crm-export-trigger').click()
    await expect(page.getByTestId('crm-export-dialog')).toBeVisible()

    await page.getByTestId('crm-export-button').click()

    await expect(page.getByTestId('crm-export-progress')).toBeVisible()
    await expect(page.getByTestId('crm-export-summary')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('crm-export-summary')).toContainText('1 created')
    await expect(page.getByTestId('crm-export-summary')).toContainText('1 updated')
  })

  test('shows partial failure details', async ({ page }) => {
    await uploadAndSearch(page, true)

    await page.route('**/api/crm/export', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCrmExportPartialFailure),
      })
    })

    await page.getByTestId('crm-export-trigger').click()
    await page.getByTestId('crm-export-button').click()

    await expect(page.getByTestId('crm-export-summary')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/1 failed record/)).toBeVisible()
  })

  test('shows error when CRM export returns 503', async ({ page }) => {
    await uploadAndSearch(page, true)

    await page.route('**/api/crm/export', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'CRM export is not configured' }),
      })
    })

    await page.getByTestId('crm-export-trigger').click()
    await page.getByTestId('crm-export-button').click()

    await expect(page.getByTestId('crm-export-error')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('crm-export-error')).toContainText('CRM export is not configured')
  })
})

test.describe('CRM Export — disabled flow', () => {
  test('hides Export to CRM button when CRM is not configured', async ({ page }) => {
    await uploadAndSearch(page, false)

    await expect(page.getByTestId('export-results-button')).toBeVisible()
    await expect(page.getByTestId('crm-export-trigger')).not.toBeVisible()
  })
})
