import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { render } from '../test/utils'
import { CompanySelect } from './CompanySelect'
import { mockContacts, mockHeaders } from '../test/fixtures'

describe('CompanySelect', () => {
  it('returns null when companyColumnKey is null', () => {
    const { container } = render(
      <CompanySelect
        contacts={mockContacts}
        companyColumnKey={null}
        value={null}
        onChange={() => {}}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders autocomplete with options from contacts', () => {
    const onChange = vi.fn()
    render(
      <CompanySelect
        contacts={mockContacts}
        companyColumnKey="Company"
        value={null}
        onChange={onChange}
      />
    )
    expect(screen.getByLabelText(/Search company/)).toBeInTheDocument()
    const input = screen.getByRole('combobox')
    fireEvent.mouseDown(input)
    expect(screen.getByText('Acme Inc')).toBeInTheDocument()
    expect(screen.getByText('Globex Corp')).toBeInTheDocument()
  })

  it('calls onChange when selecting an option', () => {
    const onChange = vi.fn()
    render(
      <CompanySelect
        contacts={mockContacts}
        companyColumnKey="Company"
        value={null}
        onChange={onChange}
      />
    )
    fireEvent.mouseDown(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText('Acme Inc'))
    expect(onChange).toHaveBeenCalledWith('Acme Inc')
  })
})
