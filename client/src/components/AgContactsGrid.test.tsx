/**
 * @file AgContactsGrid.test.tsx
 * @description Vitest unit tests for AgContactsGrid component.
 * @module List-O-Matic-2000/client
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { render } from '../test/utils'
import { AgContactsGrid } from './AgContactsGrid'
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

describe('AgContactsGrid', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(layoutRect)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows no columns message when headers are empty', () => {
    render(
      <AgContactsGrid
        contacts={mockContacts}
        headers={[]}
        companyColumnKey="Company"
        entityColumnKey={null}
      />,
    )
    expect(screen.getByText(/No columns to display/)).toBeInTheDocument()
  })

  it('renders column headers in the grid', async () => {
    render(
      <AgContactsGrid
        contacts={mockContacts}
        headers={mockHeaders}
        companyColumnKey="Company"
        entityColumnKey={null}
      />,
    )
    const grid = screen.getByRole('grid')
    await waitFor(() => {
      expect(grid.getAttribute('aria-colcount')).not.toBe('0')
    })
    expect(within(grid).getByRole('columnheader', { name: 'First' })).toBeInTheDocument()
    expect(within(grid).getByRole('columnheader', { name: 'Email' })).toBeInTheDocument()
    expect(within(grid).getByRole('columnheader', { name: 'Company' })).toBeInTheDocument()
  })
})
