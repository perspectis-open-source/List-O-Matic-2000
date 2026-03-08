/**
 * @file main.ts
 * @description Storybook config: React-Vite, stories glob, addon-essentials.
 * @module List-O-Matic-2000/client/.storybook
 */
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/blocks'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
}
export default config
