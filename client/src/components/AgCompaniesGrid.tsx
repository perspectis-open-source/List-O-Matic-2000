/**
 * @file AgCompaniesGrid.tsx
 * @description AG Grid–based sortable, filterable, resizable companies import table.
 * @module List-O-Matic-2000/client
 */
import { useMemo, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import SearchIcon from '@mui/icons-material/Search'
import { Box, InputAdornment, Paper, TextField, Typography } from '@mui/material'
import type { CompanyRow } from '../utils/parseFile'

function compareTrimmedLower(a: string, b: string): number {
  const aa = a.trim().toLowerCase()
  const bb = b.trim().toLowerCase()
  if (aa < bb) return -1
  if (aa > bb) return 1
  return 0
}

function companyColumnSizing(h: string): Pick<ColDef<CompanyRow>, 'minWidth' | 'width'> {
  if (h === 'Client Originating Attorney') return { minWidth: 200, width: 220 }
  if (h === 'Name') return { minWidth: 140, width: 160 }
  return { minWidth: 100, width: 150 }
}

type Props = {
  companies: CompanyRow[]
  headers: string[]
  maxHeight?: number
  /** When true, parent should be a flex item with a bounded height; grid fills remaining space. */
  fillContainer?: boolean
}

export function AgCompaniesGrid({ companies, headers, maxHeight = 500, fillContainer = false }: Props) {
  const [quickFilterText, setQuickFilterText] = useState('')

  const columnDefs = useMemo<ColDef<CompanyRow>[]>(
    () =>
      headers.map((h) => {
        const sizing = companyColumnSizing(h)
        const longTip = h === 'Name' || h === 'Client Originating Attorney'
        return {
          field: h,
          headerName: h,
          sortable: true,
          resizable: true,
          comparator: (valueA, valueB) =>
            compareTrimmedLower(String(valueA ?? ''), String(valueB ?? '')),
          ...sizing,
          tooltipValueGetter: longTip
            ? (p) => {
                const v = p.value
                if (v == null || v === '') return undefined
                const s = String(v)
                return s.length > 40 ? s : undefined
              }
            : undefined,
        }
      }),
    [headers],
  )

  const defaultColDef = useMemo<ColDef<CompanyRow>>(
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
      data-testid="companies-table"
    >
      <Box sx={{ flexShrink: 0, px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Filter rows (search all columns)…"
          value={quickFilterText}
          onChange={(e) => setQuickFilterText(e.target.value)}
          data-testid="companies-grid-quick-filter"
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
        data-testid="companies-grid"
      >
        <AgGridReact<CompanyRow>
          rowData={companies}
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
