/**
 * @file AgMatcherContactsGrid.test.tsx
 * @description Vitest smoke tests for AgMatcherContactsGrid.
 * @module List-O-Matic-2000/client
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
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
        onSelectionChange={() => {}}
        maxHeight={440}
      />,
    )
    const grid = screen.getByRole('grid')
    await waitFor(() => {
      expect(grid.getAttribute('aria-colcount')).not.toBe('0')
    })
    expect(within(grid).getByRole('columnheader', { name: 'Company (import)' })).toBeInTheDocument()
    expect(within(grid).getByRole('columnheader', { name: 'Match to company list' })).toBeInTheDocument()
    expect(within(grid).getByRole('columnheader', { name: 'First' })).toBeInTheDocument()
  })
})
