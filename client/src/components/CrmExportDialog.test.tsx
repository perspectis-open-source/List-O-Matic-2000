/**
 * @file CrmExportDialog.test.tsx
 * @description Vitest component tests for CrmExportDialog.
 * @module List-O-Matic-2000/client
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { render } from '../test/utils'
import { CrmExportDialog } from './CrmExportDialog'
import { mockContacts, mockHeaders } from '../test/fixtures'

vi.mock('../api/crmExport', () => ({
  postCrmExport: vi.fn(),
}))

vi.mock('../utils/exportCsv', () => ({
  downloadCsv: vi.fn(),
}))

import { postCrmExport } from '../api/crmExport'
import { downloadCsv } from '../utils/exportCsv'
import { mockCrmExportResponse, mockCrmExportPartialFailure } from '../test/crmFixtures'

describe('CrmExportDialog', () => {
  beforeEach(() => {
    vi.mocked(postCrmExport).mockReset()
    vi.mocked(downloadCsv).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing when open={false}', () => {
    render(
      <CrmExportDialog open={false} onClose={() => {}} contacts={mockContacts} headers={mockHeaders} />
    )
    expect(screen.queryByTestId('crm-export-dialog')).not.toBeInTheDocument()
  })

  it('renders dialog with field mapping inputs when open', () => {
    render(
      <CrmExportDialog open={true} onClose={() => {}} contacts={mockContacts} headers={mockHeaders} />
    )
    expect(screen.getByTestId('crm-export-dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Export to CRM' })).toBeInTheDocument()
    expect(screen.getByText('Field Mapping')).toBeInTheDocument()
    for (const header of mockHeaders) {
      expect(screen.getByLabelText(header)).toBeInTheDocument()
    }
  })

  it('shows data privacy disclaimer', () => {
    render(
      <CrmExportDialog open={true} onClose={() => {}} contacts={mockContacts} headers={mockHeaders} />
    )
    expect(screen.getByTestId('crm-export-disclaimer')).toBeInTheDocument()
    expect(screen.getByText(/appropriate consent/)).toBeInTheDocument()
  })

  it('pre-populates "email" for Email header', () => {
    render(
      <CrmExportDialog open={true} onClose={() => {}} contacts={mockContacts} headers={mockHeaders} />
    )
    const emailInput = screen.getByLabelText('Email') as HTMLInputElement
    expect(emailInput.value).toBe('email')
  })

  it('shows validation warning when no field maps to "email"', () => {
    render(
      <CrmExportDialog open={true} onClose={() => {}} contacts={mockContacts} headers={['Name', 'Company']} />
    )
    expect(screen.getByText(/No field is mapped to/)).toBeInTheDocument()
  })

  it('disables export button when no email mapping', () => {
    render(
      <CrmExportDialog open={true} onClose={() => {}} contacts={mockContacts} headers={['Name', 'Company']} />
    )
    expect(screen.getByTestId('crm-export-button')).toBeDisabled()
  })

  it('shows progress indicator during export', async () => {
    let resolveExport: (value: Awaited<ReturnType<typeof postCrmExport>>) => void
    vi.mocked(postCrmExport).mockReturnValue(
      new Promise((resolve) => {
        resolveExport = resolve
      })
    )

    render(
      <CrmExportDialog open={true} onClose={() => {}} contacts={mockContacts} headers={mockHeaders} />
    )

    fireEvent.click(screen.getByTestId('crm-export-button'))

    await waitFor(() => {
      expect(screen.getByTestId('crm-export-progress')).toBeInTheDocument()
    })

    resolveExport!(mockCrmExportResponse)
  })

  it('shows success summary after export completes', async () => {
    vi.mocked(postCrmExport).mockResolvedValueOnce(mockCrmExportResponse)

    render(
      <CrmExportDialog open={true} onClose={() => {}} contacts={mockContacts} headers={mockHeaders} />
    )

    fireEvent.click(screen.getByTestId('crm-export-button'))

    await waitFor(() => {
      expect(screen.getByTestId('crm-export-summary')).toBeInTheDocument()
    })
    expect(screen.getByText(/2 created/)).toBeInTheDocument()
    expect(screen.getByText(/1 updated/)).toBeInTheDocument()
  })

  it('shows error alert on export failure', async () => {
    vi.mocked(postCrmExport).mockRejectedValueOnce(new Error('CRM not configured'))

    render(
      <CrmExportDialog open={true} onClose={() => {}} contacts={mockContacts} headers={mockHeaders} />
    )

    fireEvent.click(screen.getByTestId('crm-export-button'))

    await waitFor(() => {
      expect(screen.getByTestId('crm-export-error')).toBeInTheDocument()
    })
    expect(screen.getByText('CRM not configured')).toBeInTheDocument()
  })

  it('shows partial failure details with download button', async () => {
    vi.mocked(postCrmExport).mockResolvedValueOnce(mockCrmExportPartialFailure)

    render(
      <CrmExportDialog open={true} onClose={() => {}} contacts={mockContacts} headers={mockHeaders} />
    )

    fireEvent.click(screen.getByTestId('crm-export-button'))

    await waitFor(() => {
      expect(screen.getByText(/2 failed record/)).toBeInTheDocument()
    })
  })

  it('"Download failed records" triggers CSV download', async () => {
    vi.mocked(postCrmExport).mockResolvedValueOnce(mockCrmExportPartialFailure)

    render(
      <CrmExportDialog open={true} onClose={() => {}} contacts={mockContacts} headers={mockHeaders} />
    )

    fireEvent.click(screen.getByTestId('crm-export-button'))

    await waitFor(() => {
      expect(screen.getByText(/2 failed record/)).toBeInTheDocument()
    })

    const accordion = screen.getByText(/2 failed record/).closest('[role="button"]')
    if (accordion) fireEvent.click(accordion)

    await waitFor(() => {
      expect(screen.getByTestId('crm-export-download-failures')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('crm-export-download-failures'))
    expect(downloadCsv).toHaveBeenCalledTimes(1)
  })
})
