/**
 * @file AgCompaniesGrid.test.tsx
 * @description Vitest smoke tests for AgCompaniesGrid.
 * @module List-O-Matic-2000/client
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { render } from '../test/utils'
import { AgCompaniesGrid } from './AgCompaniesGrid'
import type { CompanyRow } from '../utils/parseFile'

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

const mockCompanyHeaders = ['Name', 'City']
const mockCompanies: CompanyRow[] = [
  { Name: 'Acme Co', City: 'Boston' },
  { Name: 'Globex', City: 'NYC' },
]

describe('AgCompaniesGrid', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(layoutRect)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows no columns message when headers are empty', () => {
    render(<AgCompaniesGrid companies={mockCompanies} headers={[]} />)
    expect(screen.getByText(/No columns to display/)).toBeInTheDocument()
  })

  it('renders column headers in the grid', async () => {
    render(<AgCompaniesGrid companies={mockCompanies} headers={mockCompanyHeaders} maxHeight={400} />)
    const grid = screen.getByRole('grid')
    await waitFor(() => {
      expect(grid.getAttribute('aria-colcount')).not.toBe('0')
    })
    expect(within(grid).getByRole('columnheader', { name: 'Name' })).toBeInTheDocument()
    expect(within(grid).getByRole('columnheader', { name: 'City' })).toBeInTheDocument()
  })
})
