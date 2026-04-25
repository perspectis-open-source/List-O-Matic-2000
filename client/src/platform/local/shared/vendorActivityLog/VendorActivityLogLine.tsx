import { Box, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { VendorActivityLogLineProps } from './types'
import { parseBracketedTimestampLine } from './parseBracketedTimestampLine'

const textSx = {
  fontFamily: 'monospace',
  fontSize: '0.7rem',
  lineHeight: 1.45,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
} as const

export function VendorActivityLogLine({
  variant,
  line,
  children,
  palette,
  themeMode: _themeMode,
  renderBody,
  dataTestId,
  sx,
  showExpandAffordance = true,
}: VendorActivityLogLineProps) {
  void _themeMode

  const expandAffordance = showExpandAffordance ? (
    <Box
      aria-hidden
      role="presentation"
      sx={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'flex-start',
        pt: 0.125,
        opacity: 0.45,
        color: 'text.disabled',
      }}
    >
      <ExpandMoreIcon fontSize="small" />
    </Box>
  ) : null

  if (children != null) {
    const summaryTypographySx =
      variant === 'summary'
        ? { ...textSx, color: palette.stamp, fontWeight: 700 }
        : { ...textSx, color: 'text.secondary' }

    return (
      <Box
        data-testid={dataTestId}
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: showExpandAffordance ? 0.5 : 0,
          ...sx,
        }}
      >
        {expandAffordance}
        <Typography component="div" variant="caption" sx={summaryTypographySx}>
          {children}
        </Typography>
      </Box>
    )
  }

  if (line == null || line === '') {
    return null
  }

  if (variant === 'summary') {
    return (
      <Box
        data-testid={dataTestId}
        sx={{ display: 'flex', alignItems: 'flex-start', gap: showExpandAffordance ? 0.5 : 0, ...sx }}
      >
        {expandAffordance}
        <Typography component="div" variant="caption" sx={{ ...textSx, color: palette.stamp, fontWeight: 700 }}>
          {line}
        </Typography>
      </Box>
    )
  }

  const parts = parseBracketedTimestampLine(line)
  const bodySource = parts ? parts.rest : line
  const bodyNode =
    renderBody != null ? (
      renderBody(bodySource)
    ) : (
      <Box component="span" sx={{ color: 'text.secondary' }}>
        {parts ? parts.rest : line}
      </Box>
    )

  return (
    <Box
      data-testid={dataTestId}
      sx={{ display: 'flex', alignItems: 'flex-start', gap: showExpandAffordance ? 0.5 : 0, ...sx }}
    >
      {expandAffordance}
      <Typography component="div" variant="caption" sx={{ ...textSx, color: 'text.secondary' }}>
        {parts ? (
          <>
            <Box component="span" sx={{ color: palette.stamp, fontWeight: 700 }}>
              {parts.stamp}
            </Box>{' '}
            {bodyNode}
          </>
        ) : (
          bodyNode
        )}
      </Typography>
    </Box>
  )
}
