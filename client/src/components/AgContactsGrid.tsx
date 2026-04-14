/**
 * @file AgContactsGrid.tsx
 * @description AG Grid–based sortable, filterable, resizable contacts table with row virtualization.
 * @module List-O-Matic-2000/client
 */
import { useMemo, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import SearchIcon from '@mui/icons-material/Search'
import { Box, InputAdornment, Paper, TextField, Typography } from '@mui/material'
import type { ContactRow } from '../utils/parseFile'

function compareTrimmedLower(a: string, b: string): number {
  const aa = a.trim().toLowerCase()
  const bb = b.trim().toLowerCase()
  if (aa < bb) return -1
  if (aa > bb) return 1
  return 0
}

type Props = {
  contacts: ContactRow[]
  headers: string[]
  maxHeight?: number
  /** When true, parent should be a flex item with a bounded height; grid fills remaining space. */
  fillContainer?: boolean
  /** Reserved for parity with the previous table API; column detection uses App state. */
  companyColumnKey?: string | null
  entityColumnKey?: string | null
}

export function AgContactsGrid({ contacts, headers, maxHeight = 500, fillContainer = false }: Props) {
  const [quickFilterText, setQuickFilterText] = useState('')

  const columnDefs = useMemo<ColDef<ContactRow>[]>(
    () =>
      headers.map((h) => ({
        field: h,
        headerName: h,
        sortable: true,
        resizable: true,
        comparator: (valueA, valueB) =>
          compareTrimmedLower(String(valueA ?? ''), String(valueB ?? '')),
        ...(h === 'Parent company'
          ? { minWidth: 240, width: 280 }
          : { minWidth: 100, width: 150 }),
        tooltipValueGetter:
          h === 'Parent company'
            ? (p) => {
                const v = p.value
                if (v == null || v === '') return undefined
                return String(v)
              }
            : undefined,
      })),
    [headers],
  )

  const defaultColDef = useMemo<ColDef<ContactRow>>(
    () => ({
      sortable: true,
      resizable: true,
      filter: 'agTextColumnFilter',
      floatingFilter: true,
      filterParams: {
        filterOptions: ['contains', 'notContains', 'equals', 'notEqual', 'startsWith', 'endsWith'],
        defaultOption: 'contains',
        maxNumConditions: 1,
        buttons: ['reset'],
      },
    }),
    [],
  )

  const quickFilterBarHeight = 48
  /** Match previous single-block height: Math.max(200, maxHeight), minus the filter bar. */
  const outerTarget = Math.max(200, maxHeight)
  const gridHeight = Math.max(160, outerTarget - quickFilterBarHeight)

  if (headers.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: 'center' }}>
        <Typography color="text.secondary">No columns to display.</Typography>
      </Paper>
    )
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        overflow: 'hidden',
        borderRadius: 2,
        ...(fillContainer
          ? {
              flex: 1,
              minHeight: 0,
              alignSelf: 'stretch',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
            }
          : {}),
      }}
    >
      <Box sx={{ flexShrink: 0, px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Filter rows (search all columns)…"
          value={quickFilterText}
          onChange={(e) => setQuickFilterText(e.target.value)}
          data-testid="contacts-grid-quick-filter"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>
      <div
        className="ag-theme-alpine"
        style={
          fillContainer
            ? { flex: 1, minHeight: 160, width: '100%' }
            : { height: gridHeight, width: '100%' }
        }
        data-testid="contacts-grid"
      >
        <AgGridReact<ContactRow>
          rowData={contacts}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          quickFilterText={quickFilterText}
          animateRows={false}
          tooltipShowDelay={300}
          domLayout="normal"
        />
      </div>
    </Paper>
  )
}
