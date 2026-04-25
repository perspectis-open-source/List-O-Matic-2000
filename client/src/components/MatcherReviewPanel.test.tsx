/**
 * @file MatcherReviewPanel.test.tsx
 * @description Filter-to-unmatched contacts in matcher panel.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { render } from '../test/utils'
import { MatcherReviewPanel } from './MatcherReviewPanel'
import { mockContacts, mockHeaders } from '../test/fixtures'
import type { MatcherRowModel } from './MatcherReviewPanel'

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

const matcherRows: MatcherRowModel[] = [
  {
    raw: 'Acme Inc',
    source: 'llm',
    contactCount: 2,
    suggested: 'Acme Holdings LLC',
    optionHints: [],
  },
  {
    raw: 'Globex Corp',
    source: 'ambiguous',
    contactCount: 1,
    suggested: null,
    optionHints: [],
  },
]

describe('MatcherReviewPanel', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(layoutRect)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('filters grid to contacts whose import company still has no match selected', async () => {
    render(
      <MatcherReviewPanel
        canRun
        running={false}
        error={null}
        onDismissError={() => {}}
        contacts={mockContacts}
        headers={mockHeaders}
        companyColumnKey="Company"
        rows={matcherRows}
        canonicalNames={['Acme Holdings LLC', 'Globex Partners Inc']}
        selection={{ 'Acme Inc': 'Acme Holdings LLC', 'Globex Corp': '' }}
        selectionProvenance={{}}
        llmProgress={null}
        httpWaiting={false}
        activityLogEntries={[]}
        buildEvidenceUrl={() => ''}
        onSelectionChange={() => {}}
        onRun={() => {}}
      />,
    )

    const filterBtn = screen.getByTestId('matcher-filter-unmatched-only')
    expect(filterBtn).toHaveTextContent('Need match only (1)')
    fireEvent.click(filterBtn)

    expect(screen.getByText(/1 of 3 contact rows \(need match\)/)).toBeInTheDocument()

    const grid = screen.getByRole('grid')
    await waitFor(() => {
      expect(grid.getAttribute('aria-rowcount')).not.toBeNull()
    })
    const bodyRows = within(grid).getAllByRole('row').filter((r) => r.getAttribute('row-index') != null)
    expect(bodyRows).toHaveLength(1)
    expect(within(bodyRows[0]).getByText('Carol')).toBeInTheDocument()
  })

  it('filters grid to contacts whose import company has a valid list match selected', async () => {
    render(
      <MatcherReviewPanel
        canRun
        running={false}
        error={null}
        onDismissError={() => {}}
        contacts={mockContacts}
        headers={mockHeaders}
        companyColumnKey="Company"
        rows={matcherRows}
        canonicalNames={['Acme Holdings LLC', 'Globex Partners Inc']}
        selection={{ 'Acme Inc': 'Acme Holdings LLC', 'Globex Corp': '' }}
        selectionProvenance={{}}
        llmProgress={null}
        httpWaiting={false}
        activityLogEntries={[]}
        buildEvidenceUrl={() => ''}
        onSelectionChange={() => {}}
        onRun={() => {}}
      />,
    )

    const matchedBtn = screen.getByTestId('matcher-filter-matched-only')
    expect(matchedBtn).toHaveTextContent('Matched only (2)')
    fireEvent.click(matchedBtn)

    expect(screen.getByText(/2 of 3 contact rows \(matched only\)/)).toBeInTheDocument()

    const grid = screen.getByRole('grid')
    await waitFor(() => {
      expect(grid.getAttribute('aria-rowcount')).not.toBeNull()
    })
    const bodyRows = within(grid).getAllByRole('row').filter((r) => r.getAttribute('row-index') != null)
    expect(bodyRows).toHaveLength(2)
    expect(within(bodyRows[0]).getByText('Alice')).toBeInTheDocument()
    expect(within(bodyRows[1]).getByText('Bob')).toBeInTheDocument()
  })
})
