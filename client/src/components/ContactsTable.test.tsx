import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { render } from '../test/utils'
import { ContactsTable } from './ContactsTable'
import { mockContacts, mockHeaders } from '../test/fixtures'

describe('ContactsTable', () => {
  it('shows no columns message when headers are empty', () => {
    render(
      <ContactsTable
        contacts={mockContacts}
        headers={[]}
        companyColumnKey="Company"
        entityColumnKey={null}
      />
    )
    expect(screen.getByText(/No columns to display/)).toBeInTheDocument()
  })

  it('renders column headers', () => {
    render(
      <ContactsTable
        contacts={mockContacts}
        headers={mockHeaders}
        companyColumnKey="Company"
        entityColumnKey={null}
      />
    )
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Company')).toBeInTheDocument()
    // Rows are virtualized; in jsdom the scroll container may not measure so we only assert headers
  })
})
