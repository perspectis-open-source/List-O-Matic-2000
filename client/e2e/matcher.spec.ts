/**
 * @file matcher.spec.ts
 * @description E2E: Contact Company Matcher run with mocked /api/match-companies.
 */
import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import { dismissImportWorkflowDialog, chooseWorkspaceMode } from './helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test.describe('Contact Company Matcher', () => {
  test('run matcher shows suggestions in preview grid', async ({ page }) => {
    await page.goto('/')

    await page.route('**/api/match-companies', async (route) => {
      const body = (await route.request().postDataJSON()) as {
        items: { raw: string }[]
      }
      const results = (body.items ?? []).map((it) => ({
        raw: it.raw,
        match: it.raw.toLowerCase().includes('acme') ? 'Acme Holdings LLC' : 'Globex Partners Inc',
        alternates: [] as string[],
      }))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results }),
      })
    })

    await page.getByTestId('upload-trigger-contacts').click()
    const fileInput = page.getByRole('dialog').locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'sample-contacts.csv'))
    await dismissImportWorkflowDialog(page)
    await chooseWorkspaceMode(page, 'matcher')
    await expect(page.getByTestId('main-content')).toContainText('3 rows')

    await page.getByTestId('header-upload-menu-button').click()
    await page.getByTestId('header-upload-companies').click()
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'sample-companies.csv'))
    await dismissImportWorkflowDialog(page)

    await page.getByTestId('tab-results-matcher').click()

    await page.getByTestId('matcher-run-button').click()

    await expect(page.getByTestId('matcher-preview-table')).toBeVisible({ timeout: 15000 })
    const preview = page.getByTestId('matcher-preview-table')
    await expect(preview.getByText('Acme Holdings LLC').first()).toBeVisible()
    await expect(preview.getByText('Globex Partners Inc').first()).toBeVisible()
  })
})
