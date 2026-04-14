/**
 * @file UploadDropZone.stories.tsx
 * @description Storybook stories for ImportWorkflowDialog.
 * @module List-O-Matic-2000/client
 */
import type { Meta, StoryObj } from '@storybook/react'
import { ImportWorkflowDialog } from './UploadDropZone'

const meta: Meta<typeof ImportWorkflowDialog> = {
  component: ImportWorkflowDialog,
  tags: ['autodocs'],
  argTypes: {
    onImportContacts: { action: 'importContacts' },
    onImportCompanies: { action: 'importCompanies' },
    onClose: { action: 'closed' },
  },
}
export default meta

type Story = StoryObj<typeof ImportWorkflowDialog>

export const Closed: Story = {
  args: {
    open: false,
    onClose: () => {},
    entryKind: 'contacts',
    hasContacts: false,
    onImportContacts: async (file) => ({ fileName: file.name, rowCount: 0 }),
    onImportCompanies: async (file) => ({ fileName: file.name, rowCount: 0 }),
  },
}

export const OpenContacts: Story = {
  args: {
    open: true,
    onClose: () => {},
    entryKind: 'contacts',
    hasContacts: false,
    onImportContacts: async (file) => ({ fileName: file.name, rowCount: 12 }),
    onImportCompanies: async (file) => ({ fileName: file.name, rowCount: 5 }),
  },
}

export const OpenCompanies: Story = {
  args: {
    open: true,
    onClose: () => {},
    entryKind: 'companies',
    hasContacts: false,
    onImportContacts: async (file) => ({ fileName: file.name, rowCount: 12 }),
    onImportCompanies: async (file) => ({ fileName: file.name, rowCount: 5 }),
  },
}
