import { useRef, useState, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Paper, Box, Typography, TableSortLabel } from '@mui/material'

const ROW_HEIGHT = 44

type Props = {
  companies: string[]
  maxHeight?: number
}

function compare(a: string, b: string, dir: 'asc' | 'desc'): number {
  const aa = a.trim().toLowerCase()
  const bb = b.trim().toLowerCase()
  const out = aa < bb ? -1 : aa > bb ? 1 : 0
  return dir === 'asc' ? out : -out
}

export function CrmCompanyList({ companies, maxHeight = 520 }: Props) {
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const sorted = useMemo(() => {
    return [...companies].sort((a, b) => compare(a, b, sortDir))
  }, [companies, sortDir])

  const parentRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 2 }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2" color="text.secondary">
          {companies.length.toLocaleString()} companies (from CRM — system data, not imported)
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'action.hover',
          fontWeight: 600,
          fontSize: '1rem',
        }}
      >
        <TableSortLabel
          active
          direction={sortDir}
          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          sx={{ py: 1.5, px: 2 }}
        >
          Company
        </TableSortLabel>
      </Box>
      <Box
        ref={parentRef}
        sx={{
          height: Math.max(200, maxHeight - 48 - 52),
          overflow: 'auto',
        }}
      >
        <Box
          sx={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualRows.map((virtualRow) => {
            const name = sorted[virtualRow.index]
            return (
              <Box
                key={virtualRow.key}
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  display: 'flex',
                  alignItems: 'center',
                  px: 2,
                  borderBottom: 1,
                  borderColor: 'divider',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Typography variant="body2" noWrap sx={{ fontSize: '1rem' }}>
                  {name}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </Box>
    </Paper>
  )
}
