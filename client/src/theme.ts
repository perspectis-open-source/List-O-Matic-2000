import { createTheme, type PaletteMode } from '@mui/material/styles'

const GREEN_ACCENT = '#00e676'

export function getAppTheme(mode: PaletteMode) {
  return createTheme({
    shape: { borderRadius: 8 },
    palette: {
      mode,
      primary: {
        main: GREEN_ACCENT,
        contrastText: mode === 'dark' ? '#000' : '#000',
      },
      ...(mode === 'dark' && {
        background: {
          default: '#121212',
          paper: '#1e1e1e',
        },
      }),
    },
  })
}
