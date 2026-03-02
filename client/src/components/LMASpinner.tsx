import { Box, CircularProgress } from '@mui/material'

const LMA_BLUE = '#3F47AA'
const LMA_CHARCOAL = '#4D4A4F'

export function LMASpinner() {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      <CircularProgress
        size={28}
        thickness={4}
        sx={{
          color: LMA_BLUE,
          '& .MuiCircularProgress-circle': {
            strokeLinecap: 'round',
          },
        }}
      />
      <Box
        component="span"
        sx={{
          fontFamily: 'monospace',
          fontWeight: 700,
          fontSize: '0.75rem',
          letterSpacing: 0.5,
          color: LMA_CHARCOAL,
        }}
      >
        LMA
      </Box>
    </Box>
  )
}
