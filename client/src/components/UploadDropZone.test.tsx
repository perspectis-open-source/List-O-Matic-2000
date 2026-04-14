/**
 * @file UploadDropZone.test.tsx
 * @description Vitest unit tests for ImportWorkflowDialog (UploadDropZone module).
 * @module List-O-Matic-2000/client
 */
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, fireEvent, render } from '../test/utils'
import { ImportWorkflowDialog } from './UploadDropZone'

const defaultProps = {
  open: true,
  onClose: () => {},
  entryKind: 'contacts' as const,
  hasContacts: false,
  onImportContacts: vi.fn().mockResolvedValue({ fileName: 'c.csv', rowCount: 1 }),
  onImportCompanies: vi.fn().mockResolvedValue({ fileName: 'co.csv', rowCount: 2 }),
}

describe('ImportWorkflowDialog', () => {
  it('renders nothing when closed', () => {
    render(<ImportWorkflowDialog {...defaultProps} open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders dialog with dropzone when open', () => {
    render(<ImportWorkflowDialog {...defaultProps} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Import contacts')).toBeInTheDocument()
    expect(screen.getByText(/Drag and drop a CSV/)).toBeInTheDocument()
  })

  it('shows companies title when entryKind is companies', () => {
    render(<ImportWorkflowDialog {...defaultProps} entryKind="companies" />)
    expect(screen.getByText('Import companies')).toBeInTheDocument()
  })

  it('shows parsing state then success actions after file is accepted', async () => {
    let resolveImport!: (v: { fileName: string; rowCount: number }) => void
    const importPromise = new Promise<{ fileName: string; rowCount: number }>((r) => {
      resolveImport = r
    })
    const onImportContacts = vi.fn().mockReturnValue(importPromise)

    render(<ImportWorkflowDialog {...defaultProps} onImportContacts={onImportContacts} />)

    const file = new File(['x'], 'rows.csv', { type: 'text/csv' })
    const input = screen.getByTestId('import-workflow-file-input')
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText('Reading file…')).toBeInTheDocument()
    expect(screen.getByTestId('import-workflow-cancel')).toBeDisabled()

    resolveImport({ fileName: 'rows.csv', rowCount: 42 })

    await waitFor(() => {
      expect(screen.getByText(/Loaded 42 rows/)).toBeInTheDocument()
    })
    expect(screen.getByTestId('import-workflow-next')).toHaveTextContent(/Add companies/)
    expect(screen.getByTestId('import-workflow-skip')).toHaveTextContent(/^Skip$/)
    expect(screen.getByTestId('import-workflow-cancel')).not.toBeDisabled()
  })

  it('after companies import with existing contacts, shows Done only', async () => {
    const onImportCompanies = vi.fn().mockResolvedValue({ fileName: 'co.csv', rowCount: 3 })

    render(
      <ImportWorkflowDialog
        {...defaultProps}
        entryKind="companies"
        hasContacts={true}
        onImportCompanies={onImportCompanies}
      />
    )

    const file = new File(['x'], 'co.csv', { type: 'text/csv' })
    fireEvent.change(screen.getByTestId('import-workflow-file-input'), { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByTestId('import-workflow-done')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('import-workflow-skip')).not.toBeInTheDocument()
  })
})
