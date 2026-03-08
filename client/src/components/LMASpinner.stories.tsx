/**
 * @file LMASpinner.stories.tsx
 * @description Storybook stories for LMASpinner component.
 * @module List-O-Matic-2000/client
 */
import type { Meta, StoryObj } from '@storybook/react'
import { LMASpinner } from './LMASpinner'

const meta: Meta<typeof LMASpinner> = {
  component: LMASpinner,
  tags: ['autodocs'],
}
export default meta

type Story = StoryObj<typeof LMASpinner>

export const Default: Story = {}
