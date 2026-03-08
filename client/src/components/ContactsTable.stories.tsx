import type { Meta, StoryObj } from '@storybook/react'
import { ContactsTable } from './ContactsTable'
import { mockContacts, mockHeaders } from '../test/fixtures'

const meta: Meta<typeof ContactsTable> = {
  component: ContactsTable,
  tags: ['autodocs'],
}
export default meta

type Story = StoryObj<typeof ContactsTable>

export const WithData: Story = {
  args: {
    contacts: mockContacts,
    headers: mockHeaders,
    maxHeight: 400,
    companyColumnKey: 'Company',
    entityColumnKey: null,
  },
}

export const Empty: Story = {
  args: {
    contacts: [],
    headers: mockHeaders,
    maxHeight: 400,
    companyColumnKey: 'Company',
    entityColumnKey: null,
  },
}

export const NoHeaders: Story = {
  args: {
    contacts: mockContacts,
    headers: [],
    maxHeight: 400,
  },
}
