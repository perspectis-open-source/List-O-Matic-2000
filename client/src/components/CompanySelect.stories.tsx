import type { Meta, StoryObj } from '@storybook/react'
import { CompanySelect } from './CompanySelect'
import { mockContacts, mockHeaders } from '../test/fixtures'

const meta: Meta<typeof CompanySelect> = {
  component: CompanySelect,
  tags: ['autodocs'],
  argTypes: {
    onChange: { action: 'change' },
  },
}
export default meta

type Story = StoryObj<typeof CompanySelect>

export const WithOptions: Story = {
  args: {
    contacts: mockContacts,
    companyColumnKey: 'Company',
    value: null,
    onChange: () => {},
  },
}

export const WithValue: Story = {
  args: {
    contacts: mockContacts,
    companyColumnKey: 'Company',
    value: 'Acme Inc',
    onChange: () => {},
  },
}

export const Disabled: Story = {
  args: {
    contacts: mockContacts,
    companyColumnKey: 'Company',
    value: null,
    onChange: () => {},
    disabled: true,
  },
}

export const NoCompanyColumn: Story = {
  args: {
    contacts: mockContacts,
    companyColumnKey: null,
    value: null,
    onChange: () => {},
  },
}
