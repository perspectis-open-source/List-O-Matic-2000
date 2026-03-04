import { createTheme, type PaletteMode } from '@mui/material/styles'

// Design tokens from slides (single source of truth)
const SLATE_50 = '#F8FAFC'
const SLATE_400 = '#94A3B8'
const SLATE_500 = '#64748B'
const SLATE_600 = '#475569'
const SLATE_700 = '#334155'
const SLATE_800 = '#1E293B'
const SLATE_900 = '#0F172A'
const SKY_400 = '#38BDF8'
const ACCENT_TINT = 'rgba(56, 189, 248, 0.1)'
const ACCENT_BORDER = 'rgba(56, 189, 248, 0.3)'
const SURFACE_TRANSLUCENT = 'rgba(30, 41, 59, 0.8)'
const BORDER_DIVIDER = 'rgba(51, 65, 85, 0.5)'
const PURPLE = '#A855F7'
const EMERALD = '#10B981'
const ROSE = '#F43F5E'

const FONT_BODY = '"Inter", sans-serif'
const FONT_HEADING = '"Space Grotesk", "Inter", sans-serif'

export function getAppTheme(mode: PaletteMode) {
  const isDark = mode === 'dark'
  return createTheme({
    shape: { borderRadius: 8 },
    palette: {
      mode,
      primary: {
        main: SKY_400,
        contrastText: SLATE_900,
      },
      secondary: {
        main: SLATE_600,
        contrastText: SLATE_50,
      },
      success: { main: EMERALD },
      error: { main: ROSE },
      info: { main: SKY_400 },
      warning: { main: PURPLE },
      background: isDark
        ? { default: SLATE_900, paper: SLATE_800 }
        : { default: SLATE_50, paper: '#ffffff' },
      text: isDark
        ? { primary: SLATE_50, secondary: SLATE_400, disabled: SLATE_500 }
        : { primary: SLATE_900, secondary: SLATE_600, disabled: SLATE_500 },
      divider: SLATE_700,
    },
    typography: {
      fontFamily: FONT_BODY,
      h1: { fontFamily: FONT_HEADING, fontWeight: 700 },
      h2: { fontFamily: FONT_HEADING, fontWeight: 600 },
      h3: { fontFamily: FONT_HEADING, fontWeight: 600 },
      h4: { fontFamily: FONT_HEADING, fontWeight: 600 },
      h5: { fontFamily: FONT_HEADING, fontWeight: 600 },
      h6: { fontFamily: FONT_HEADING, fontWeight: 600 },
      button: { fontFamily: FONT_BODY, fontWeight: 500 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { fontFamily: FONT_BODY },
          '*:focus-visible': {
            outline: `2px solid ${SKY_400}`,
            outlineOffset: 2,
          },
          '.MuiTab-root:focus-visible': {
            borderRadius: 4,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: SLATE_900,
            borderBottom: `1px solid ${SLATE_700}`,
            color: SLATE_50,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            '&:focus-visible': {
              outline: `2px solid ${SKY_400}`,
              outlineOffset: 2,
            },
          },
          containedPrimary: {
            backgroundColor: SKY_400,
            color: SLATE_900,
            '&:hover': {
              filter: 'brightness(1.1)',
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            '&:focus-visible': {
              outline: `2px solid ${SKY_400}`,
              outlineOffset: 2,
            },
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            fontFamily: FONT_BODY,
            textTransform: 'none',
            border: 'none',
            boxShadow: 'none',
            outline: 'none',
            minHeight: 48,
            '&.Mui-selected': {
              border: 'none',
              boxShadow: 'none',
              background: 'none',
            },
            '&:focus-visible': {
              outline: `2px solid ${SKY_400}`,
              outlineOffset: 2,
              borderRadius: 4,
            },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            minHeight: 48,
          },
          flexContainer: {
            gap: 0,
          },
          indicator: {
            backgroundColor: SKY_400,
            height: 3,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? SLATE_800 : undefined,
            borderColor: isDark ? SLATE_700 : undefined,
            ...(isDark && { border: `1px solid ${SLATE_700}` }),
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          standardInfo: {
            backgroundColor: ACCENT_TINT,
            borderLeft: `4px solid ${SKY_400}`,
          },
          standardSuccess: {
            borderLeft: `4px solid ${EMERALD}`,
          },
          standardError: {
            borderLeft: `4px solid ${ROSE}`,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          colorPrimary: {
            backgroundColor: ACCENT_TINT,
            border: `1px solid ${ACCENT_BORDER}`,
            color: isDark ? SLATE_50 : SLATE_900,
            '& .MuiChip-icon': { color: SKY_400 },
          },
        },
      },
    },
  })
}

// Export tokens for use in sx or custom components when theme.palette isn't enough
export const slideTokens = {
  SLATE_50,
  SLATE_400,
  SLATE_500,
  SLATE_600,
  SLATE_700,
  SLATE_800,
  SLATE_900,
  SKY_400,
  ACCENT_TINT,
  ACCENT_BORDER,
  PURPLE,
  EMERALD,
  ROSE,
  FONT_BODY,
  FONT_HEADING,
}
