/**
 * @file UploadDropZone.stories.tsx
 * @description Storybook stories for UploadDropZone component.
 * @module List-O-Matic-2000/client
 */
import type { Meta, StoryObj } from '@storybook/react'
import { UploadDropZone } from './UploadDropZone'

const meta: Meta<typeof UploadDropZone> = {
  component: UploadDropZone,
  tags: ['autodocs'],
  argTypes: {
    onFileAccepted: { action: 'fileAccepted' },
    onClose: { action: 'closed' },
  },
}
export default meta

type Story = StoryObj<typeof UploadDropZone>

export const Closed: Story = {
  args: {
    open: false,
    onClose: () => {},
    onFileAccepted: () => {},
  },
}

export const Open: Story = {
  args: {
    open: true,
    onClose: () => {},
    onFileAccepted: () => {},
  },
}
