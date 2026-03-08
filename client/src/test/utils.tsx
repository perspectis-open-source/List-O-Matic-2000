/**
 * @file utils.tsx
 * @description Test render helper with MUI ThemeProvider for component tests.
 * @module List-O-Matic-2000/client
 */
import type { ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { getAppTheme } from '../theme'

function AllThemes({ children }: { children: React.ReactNode }) {
  const theme = getAppTheme('light')
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}

function customRender(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, {
    wrapper: ({ children }) => <AllThemes>{children}</AllThemes>,
    ...options,
  })
}

export * from '@testing-library/react'
export { customRender as render }
