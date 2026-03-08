/**
 * @file LMASpinner.tsx
 * @description LMA-themed loading spinner for upload and AI Search states.
 * @module List-O-Matic-2000/client
 */
import { Box, CircularProgress } from '@mui/material'

const L_O_M_2000_BLUE = '#3F47AA'
const L_O_M_2000_CHARCOAL = '#4D4A4F'

export function LMASpinner() {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      <CircularProgress
        size={28}
        thickness={4}
        sx={{
          color: L_O_M_2000_BLUE,
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
          color: L_O_M_2000_CHARCOAL,
        }}
      >
        List-O-Matic 2000
      </Box>
    </Box>
  )
}
