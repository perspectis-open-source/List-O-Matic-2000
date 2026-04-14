/**
 * @file helpers.ts
 * @description Shared Playwright helpers for E2E tests.
 */
import type { Page } from '@playwright/test'

/** Closes the import workflow after a file has been parsed (Skip / Continue / or Done when contacts already exist). */
export async function dismissImportWorkflowDialog(page: Page) {
  const btn = page.getByTestId('import-workflow-skip').or(page.getByTestId('import-workflow-done'))
  await btn.waitFor({ state: 'visible', timeout: 20000 })
  await btn.click()
}

/** After contacts are loaded, pick Normalizer or Matcher workflow (hides the other feature set). */
export async function chooseWorkspaceMode(page: Page, mode: 'normalizer' | 'matcher') {
  const testId = mode === 'normalizer' ? 'workspace-mode-normalizer' : 'workspace-mode-matcher'
  await page.getByTestId(testId).waitFor({ state: 'visible', timeout: 20000 })
  await page.getByTestId(testId).click()
}
