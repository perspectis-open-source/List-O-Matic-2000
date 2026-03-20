/**
 * @file crmFixtures.ts
 * @description CRM-specific test fixtures. Isolated from shared fixtures.ts.
 * @module List-O-Matic-2000/client
 */
import type { CrmExportResponse } from '../api/crmExport'

export const mockCrmExportResponse: CrmExportResponse = {
  totalSent: 3,
  created: 2,
  updated: 1,
  failed: 0,
  errors: [],
}

export const mockCrmExportPartialFailure: CrmExportResponse = {
  totalSent: 3,
  created: 1,
  updated: 0,
  failed: 2,
  errors: [
    { email: 'bad@acme.com', error: '400: Invalid email format' },
    { email: 'missing@acme.com', error: '500: Internal server error' },
  ],
}
