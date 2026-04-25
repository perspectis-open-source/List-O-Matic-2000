import type { SxProps, Theme } from '@mui/material/styles'
import type { ReactNode } from 'react'

export type VendorActivityLogPalette = {
  stamp: string
  tokens: string
  cost: string
}

export type VendorActivityLogVariant = 'log' | 'summary'

export type VendorActivityLogLineProps = {
  variant: VendorActivityLogVariant
  line?: string
  children?: ReactNode
  palette: VendorActivityLogPalette
  themeMode: 'light' | 'dark'
  renderBody?: (body: string) => ReactNode
  rowKey?: string
  dataTestId?: string
  sx?: SxProps<Theme>
  showExpandAffordance?: boolean
}
