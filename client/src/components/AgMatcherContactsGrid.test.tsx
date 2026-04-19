/**
 * @file AgMatcherContactsGrid.test.tsx
 * @description Vitest smoke tests for AgMatcherContactsGrid.
 * @module List-O-Matic-2000/client
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { render } from '../test/utils'
import { AgMatcherContactsGrid } from './AgMatcherContactsGrid'
import { mockContacts, mockHeaders } from '../test/fixtures'

const layoutRect: DOMRect = {
  width: 1024,
  height: 800,
  top: 0,
  left: 0,
  bottom: 800,
  right: 1024,
  x: 0,
  y: 0,
  toJSON: () => ({}),
}

describe('AgMatcherContactsGrid', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(layoutRect)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows no columns message when company column is missing', () => {
    render(
      <AgMatcherContactsGrid
        contacts={mockContacts}
        headers={mockHeaders}
        companyColumnKey={null}
        canonicalNames={['Acme Holdings LLC']}
        selection={{}}
        selectionProvenance={{}}
        onSelectionChange={() => {}}
      />,
    )
    expect(screen.getByText(/No columns to display/)).toBeInTheDocument()
  })

  it('renders import and match column headers', async () => {
    render(
      <AgMatcherContactsGrid
        contacts={mockContacts}
        headers={mockHeaders}
        companyColumnKey="Company"
        canonicalNames={['Acme Holdings LLC', 'Globex Partners Inc']}
        selection={{}}
        selectionProvenance={{}}
        onSelectionChange={() => {}}
        maxHeight={440}
      />,
    )
    const grid = screen.getByRole('grid')
    await waitFor(() => {
      expect(grid.getAttribute('aria-colcount')).not.toBe('0')
    })
    expect(within(grid).getByRole('columnheader', { name: 'Company (Import)' })).toBeInTheDocument()
    expect(within(grid).getByRole('columnheader', { name: 'Company (CRM)' })).toBeInTheDocument()
    expect(within(grid).getByRole('columnheader', { name: 'First' })).toBeInTheDocument()
  })

  it('shows Select Company placeholder when no pick and not explicit Skip', async () => {
    const oneRow = [mockContacts[0]]
    render(
      <AgMatcherContactsGrid
        contacts={oneRow}
        headers={mockHeaders}
        companyColumnKey="Company"
        canonicalNames={['Acme Holdings LLC']}
        selection={{}}
        selectionProvenance={{}}
        onSelectionChange={() => {}}
        maxHeight={440}
      />,
    )
    const grid = screen.getByRole('grid')
    await waitFor(() => {
      expect(grid.getAttribute('aria-colcount')).not.toBe('0')
    })
    const el = screen.getByTestId('matcher-match-select')
    expect(el).toHaveAttribute('data-match-display', 'placeholder')
    expect(screen.getByText('Select Company…')).toBeInTheDocument()
  })

  it('shows placeholder when selection is empty string but provenance is not manual', async () => {
    const oneRow = [mockContacts[0]]
    render(
      <AgMatcherContactsGrid
        contacts={oneRow}
        headers={mockHeaders}
        companyColumnKey="Company"
        canonicalNames={['Acme Holdings LLC']}
        selection={{ 'Acme Inc': '' }}
        selectionProvenance={{}}
        onSelectionChange={() => {}}
        maxHeight={440}
      />,
    )
    const grid = screen.getByRole('grid')
    await waitFor(() => {
      expect(grid.getAttribute('aria-colcount')).not.toBe('0')
    })
    expect(screen.getByTestId('matcher-match-select')).toHaveAttribute('data-match-display', 'placeholder')
  })

  it('shows Skip label when user chose Skip (empty value + manual provenance)', async () => {
    const oneRow = [mockContacts[0]]
    render(
      <AgMatcherContactsGrid
        contacts={oneRow}
        headers={mockHeaders}
        companyColumnKey="Company"
        canonicalNames={['Acme Holdings LLC']}
        selection={{ 'Acme Inc': '' }}
        selectionProvenance={{ 'Acme Inc': 'manual' }}
        onSelectionChange={() => {}}
        maxHeight={440}
      />,
    )
    const grid = screen.getByRole('grid')
    await waitFor(() => {
      expect(grid.getAttribute('aria-colcount')).not.toBe('0')
    })
    const el = screen.getByTestId('matcher-match-select')
    expect(el).toHaveAttribute('data-match-display', 'skip')
    expect(screen.getByText(/Skip/)).toBeInTheDocument()
  })

  it('marks match selects with data-provenance llm when set', async () => {
    const oneRow = [mockContacts[0]]
    render(
      <AgMatcherContactsGrid
        contacts={oneRow}
        headers={mockHeaders}
        companyColumnKey="Company"
        canonicalNames={['Acme Holdings LLC']}
        selection={{ 'Acme Inc': 'Acme Holdings LLC' }}
        selectionProvenance={{ 'Acme Inc': 'llm' }}
        onSelectionChange={() => {}}
        maxHeight={440}
      />,
    )
    const grid = screen.getByRole('grid')
    await waitFor(() => {
      expect(grid.getAttribute('aria-colcount')).not.toBe('0')
    })
    const el = screen.getByTestId('matcher-match-select')
    expect(el).toHaveAttribute('data-provenance', 'llm')
  })

  it('shows tooltip on hover with parent vs CRM narrative', async () => {
    const oneRow = [mockContacts[0]]
    render(
      <AgMatcherContactsGrid
        contacts={oneRow}
        headers={mockHeaders}
        companyColumnKey="Company"
        canonicalNames={['Acme Holdings LLC']}
        selection={{ 'Acme Inc': 'Acme Holdings LLC' }}
        selectionProvenance={{ 'Acme Inc': 'llm' }}
        matchExplainByRaw={{
          'Acme Inc': {
            source: 'llm',
            suggested: 'Acme Holdings LLC',
            optionHints: ['Acme Holdings LLC', 'Other Co'],
            contactCount: 2,
          },
        }}
        matcherParentByRaw={{ 'Acme Inc': 'Acme Holdings LLC' }}
        matcherParentByCanon={{ 'Acme Holdings LLC': 'Acme Holdings LLC' }}
        onSelectionChange={() => {}}
        maxHeight={440}
      />,
    )
    const grid = screen.getByRole('grid')
    await waitFor(() => {
      expect(grid.getAttribute('aria-colcount')).not.toBe('0')
    })
    fireEvent.mouseOver(screen.getByTestId('matcher-match-select'))
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent(/Contact company of Acme Inc mapped to Parent/)
    })
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      /CRM company is Acme Holdings LLC, so it matched\./,
    )
  })
})
