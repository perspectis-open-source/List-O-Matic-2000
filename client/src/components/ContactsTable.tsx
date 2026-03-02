import { useRef, Fragment } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Paper, Box, Tooltip, Typography } from '@mui/material'
import type { ContactRow } from '../utils/parseFile'

const ROW_HEIGHT = 48

type Props = {
  contacts: ContactRow[]
  headers: string[]
  maxHeight?: number
  companyColumnKey?: string | null
  entityColumnKey?: string | null
}

export function ContactsTable({ contacts, headers, maxHeight = 500, companyColumnKey, entityColumnKey }: Props) {
  const parentRef = useRef<HTMLDivElement>(null)
  const colTemplate = headers.length
    ? `repeat(${headers.length}, minmax(100px, 1fr))`
    : '1fr'

  const rowVirtualizer = useVirtualizer({
    count: contacts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 2 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: colTemplate,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          fontWeight: 600,
          fontSize: '0.875rem',
        }}
      >
        {headers.map((h) => (
          <Box key={h} sx={{ px: 1.5, py: 1.25 }}>
            {h}
          </Box>
        ))}
      </Box>
      <div ref={parentRef} style={{ overflow: 'auto', maxHeight }}>
        <div style={{ height: totalSize, position: 'relative' }}>
          {virtualRows.map((virtualRow) => {
            const row = contacts[virtualRow.index]
            return (
              <Box
                key={virtualRow.key}
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: ROW_HEIGHT,
                  transform: `translateY(${virtualRow.start}px)`,
                  display: 'grid',
                  gridTemplateColumns: colTemplate,
                  borderBottom: 1,
                  borderColor: 'divider',
                  alignItems: 'center',
                  fontSize: '0.875rem',
                  '& > *': {
                    px: 1.5,
                    py: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                }}
              >
                {headers.map((h) => {
                  const value = row[h] ?? ''
                  const isCompany = companyColumnKey && h === companyColumnKey
                  const entity = entityColumnKey ? (row[entityColumnKey] ?? '').trim() : ''
                  const showTooltip = isCompany && entity
                  const tooltipTitle = showTooltip ? (
                    <Box sx={{ maxWidth: 360, p: 0.5 }}>
                      <Typography variant="body2" component="span" fontWeight={600}>
                        {value} company name.
                      </Typography>
                      <Typography variant="body2" component="p" sx={{ mt: 0.5 }}>Entity: {entity}</Typography>
                    </Box>
                  ) : ''
                  const cell = <Box component="span">{value}</Box>
                  return (
                    <Fragment key={h}>
                      {showTooltip ? (
                        <Tooltip title={tooltipTitle} enterDelay={300}>
                          <Box component="span" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</Box>
                        </Tooltip>
                      ) : cell}
                    </Fragment>
                  )
                })}
              </Box>
            )
          })}
        </div>
      </div>
    </Paper>
  )
}
