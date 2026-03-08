import type { Preview } from '@storybook/react'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { getAppTheme } from '../src/theme'
import '../src/index.css'

const theme = getAppTheme('light')

const preview: Preview = {
  parameters: {
    controls: { matchers: ['color', 'background'] },
  },
  decorators: [
    (Story) => (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Story />
      </ThemeProvider>
    ),
  ],
}
export default preview
