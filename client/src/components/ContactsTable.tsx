import { useRef, Fragment, useState, useMemo, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Paper, Box, TableSortLabel, Tooltip, Typography } from '@mui/material'
import type { ContactRow } from '../utils/parseFile'

const ROW_HEIGHT = 48

type Props = {
  contacts: ContactRow[]
  headers: string[]
  maxHeight?: number
  companyColumnKey?: string | null
  entityColumnKey?: string | null
}

function compare(a: string, b: string, dir: 'asc' | 'desc'): number {
  const aa = a.trim().toLowerCase()
  const bb = b.trim().toLowerCase()
  const out = aa < bb ? -1 : aa > bb ? 1 : 0
  return dir === 'asc' ? out : -out
}

export function ContactsTable({ contacts, headers, maxHeight = 500 }: Props) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)

  const sortedContacts = useMemo(() => {
    if (!sort) return [...contacts]
    return [...contacts].sort((ra, rb) => {
      const a = String(ra[sort.key] ?? '')
      const b = String(rb[sort.key] ?? '')
      return compare(a, b, sort.dir)
    })
  }, [contacts, sort])

  const handleSort = useCallback((key: string) => {
    setSort((prev) => {
      if (prev?.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      }
      return { key, dir: 'asc' }
    })
  }, [])

  const parentRef = useRef<HTMLDivElement>(null)
  const colTemplate = useMemo(() => {
    if (!headers.length) return '1fr'
    return headers
      .map((h) => (h === 'Parent company' ? 'minmax(240px, 1fr)' : 'minmax(100px, 1fr)'))
      .join(' ')
  }, [headers])

  const rowVirtualizer = useVirtualizer({
    count: sortedContacts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()

  if (headers.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: 'center' }}>
        <Typography color="text.secondary">No columns to display.</Typography>
      </Paper>
    )
  }

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
          fontSize: '1rem',
        }}
      >
        {headers.map((h) => (
          <Box key={h} sx={{ px: 1.5, py: 1.25, display: 'flex', alignItems: 'center' }}>
            <TableSortLabel
              active={sort?.key === h}
              direction={sort?.key === h ? sort.dir : 'asc'}
              onClick={() => handleSort(h)}
            >
              {h}
            </TableSortLabel>
          </Box>
        ))}
      </Box>
      <div ref={parentRef} style={{ overflow: 'auto', height: Math.max(200, maxHeight - 48) }}>
        <div style={{ height: totalSize, position: 'relative' }}>
          {virtualRows.map((virtualRow) => {
            const row = sortedContacts[virtualRow.index]
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
                  fontSize: '1rem',
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
                  const value = String(row[h] ?? '')
                  const isParentCompany = h === 'Parent company'
                  const cell = (
                    <Box
                      component="span"
                      sx={{
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {value}
                    </Box>
                  )
                  return (
                    <Fragment key={h}>
                      {isParentCompany && value ? (
                        <Tooltip title={value} placement="top" enterDelay={300}>
                          {cell}
                        </Tooltip>
                      ) : (
                        cell
                      )}
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
