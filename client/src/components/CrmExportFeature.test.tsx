/**
 * @file CrmExportFeature.test.tsx
 * @description Vitest component tests for CrmExportFeature wrapper.
 * @module List-O-Matic-2000/client
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { render } from '../test/utils'
import { CrmExportFeature } from './CrmExportFeature'
import { mockContacts, mockHeaders } from '../test/fixtures'

vi.mock('../api/crmExport', () => ({
  fetchCrmEnabled: vi.fn(),
  postCrmExport: vi.fn(),
}))

import { fetchCrmEnabled } from '../api/crmExport'

describe('CrmExportFeature', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing when fetchCrmEnabled returns false', async () => {
    vi.mocked(fetchCrmEnabled).mockResolvedValueOnce(false)

    const { container } = render(
      <CrmExportFeature contacts={mockContacts} headers={mockHeaders} />
    )

    await waitFor(() => {
      expect(vi.mocked(fetchCrmEnabled)).toHaveBeenCalledTimes(1)
    })

    expect(container.innerHTML).toBe('')
  })

  it('renders "Export to CRM" button when fetchCrmEnabled returns true', async () => {
    vi.mocked(fetchCrmEnabled).mockResolvedValueOnce(true)

    render(
      <CrmExportFeature contacts={mockContacts} headers={mockHeaders} />
    )

    await waitFor(() => {
      expect(screen.getByTestId('crm-export-trigger')).toBeInTheDocument()
    })
    expect(screen.getByText('Export to CRM')).toBeInTheDocument()
  })

  it('renders nothing while feature detection is loading', () => {
    vi.mocked(fetchCrmEnabled).mockReturnValue(new Promise(() => {}))

    const { container } = render(
      <CrmExportFeature contacts={mockContacts} headers={mockHeaders} />
    )

    expect(container.innerHTML).toBe('')
    expect(screen.queryByTestId('crm-export-trigger')).not.toBeInTheDocument()
  })

  it('clicking the button opens the CrmExportDialog', async () => {
    vi.mocked(fetchCrmEnabled).mockResolvedValueOnce(true)

    render(
      <CrmExportFeature contacts={mockContacts} headers={mockHeaders} />
    )

    await waitFor(() => {
      expect(screen.getByTestId('crm-export-trigger')).toBeInTheDocument()
    })

    screen.getByTestId('crm-export-trigger').click()

    await waitFor(() => {
      expect(screen.getByTestId('crm-export-dialog')).toBeInTheDocument()
    })
  })
})
