/**
 * @file AgContactsGrid.stories.tsx
 * @description Storybook stories for AgContactsGrid component.
 * @module List-O-Matic-2000/client
 */
import type { Meta, StoryObj } from '@storybook/react'
import { AgContactsGrid } from './AgContactsGrid'
import { mockContacts, mockHeaders } from '../test/fixtures'

const meta: Meta<typeof AgContactsGrid> = {
  component: AgContactsGrid,
  tags: ['autodocs'],
}
export default meta

type Story = StoryObj<typeof AgContactsGrid>

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
