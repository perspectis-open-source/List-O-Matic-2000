/**
 * @file ParentKeyGrid.tsx
 * @description Two-column AG Grid for Company Key / Contact Company Key reference tables.
 */
import { useMemo, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import SearchIcon from '@mui/icons-material/Search'
import { Box, InputAdornment, Paper, TextField, Typography } from '@mui/material'

export type ParentKeyRow = { name: string; parentCompany: string }

function compareTrimmedLower(a: string, b: string): number {
  const aa = a.trim().toLowerCase()
  const bb = b.trim().toLowerCase()
  if (aa < bb) return -1
  if (aa > bb) return 1
  return 0
}

type Props = {
  rows: ParentKeyRow[]
  nameHeader: string
  fillContainer?: boolean
  caption?: string
  'data-testid'?: string
}

export function ParentKeyGrid({
  rows,
  nameHeader,
  fillContainer = false,
  caption,
  'data-testid': dataTestId = 'parent-key-grid',
}: Props) {
  const [quickFilterText, setQuickFilterText] = useState('')

  const columnDefs = useMemo<ColDef<ParentKeyRow>[]>(
    () => [
      {
        field: 'name',
        headerName: nameHeader,
        sortable: true,
        resizable: true,
        minWidth: 160,
        flex: 1,
        comparator: (a, b) => compareTrimmedLower(String(a ?? ''), String(b ?? '')),
      },
      {
        field: 'parentCompany',
        headerName: 'Parent company',
        sortable: true,
        resizable: true,
        minWidth: 200,
        flex: 1,
        comparator: (a, b) => compareTrimmedLower(String(a ?? ''), String(b ?? '')),
      },
    ],
    [nameHeader],
  )

  const defaultColDef = useMemo<ColDef<ParentKeyRow>>(
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
  const gridHeight = Math.max(160, 400 - quickFilterBarHeight)

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
      data-testid={dataTestId}
    >
      {caption != null && caption !== '' && (
        <Box sx={{ flexShrink: 0, px: 1.5, pt: 1, pb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {caption}
          </Typography>
        </Box>
      )}
      <Box sx={{ flexShrink: 0, px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Filter rows…"
          value={quickFilterText}
          onChange={(e) => setQuickFilterText(e.target.value)}
          data-testid={`${dataTestId}-quick-filter`}
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
          fillContainer ? { flex: 1, minHeight: 160, width: '100%' } : { height: gridHeight, width: '100%' }
        }
        data-testid={`${dataTestId}-ag`}
      >
        <AgGridReact<ParentKeyRow>
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          quickFilterText={quickFilterText}
          animateRows={false}
          domLayout="normal"
        />
      </div>
    </Paper>
  )
}
