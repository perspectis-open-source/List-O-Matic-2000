/**
 * @file MatchKeyGrid.tsx
 * @description AG Grid: contact company, CRM label from companies import, matched list pick, parent.
 */
import { useMemo, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import SearchIcon from '@mui/icons-material/Search'
import { Box, InputAdornment, Paper, TextField, Typography } from '@mui/material'
import type { MatchKeyGridRow } from '../utils/matcherContactMatchGrid'

function compareTrimmedLower(a: string, b: string): number {
  const aa = a.trim().toLowerCase()
  const bb = b.trim().toLowerCase()
  if (aa < bb) return -1
  if (aa > bb) return 1
  return 0
}

function nonEmptyTrimmed(v: unknown): boolean {
  return String(v ?? '').trim().length > 0
}

function columnTotals(rows: MatchKeyGridRow[]) {
  let contactCompany = 0
  let crmCompany = 0
  let matchedCompany = 0
  let parentCompany = 0
  for (const r of rows) {
    if (nonEmptyTrimmed(r.contactCompany)) contactCompany++
    if (nonEmptyTrimmed(r.crmCompany)) crmCompany++
    if (nonEmptyTrimmed(r.matchedCompany)) matchedCompany++
    if (nonEmptyTrimmed(r.parentCompany)) parentCompany++
  }
  return { contactCompany, crmCompany, matchedCompany, parentCompany }
}

type Props = {
  rows: MatchKeyGridRow[]
  fillContainer?: boolean
  caption?: string
  'data-testid'?: string
  matchedOnly: boolean
}

export function MatchKeyGrid({
  rows,
  fillContainer = false,
  caption,
  'data-testid': dataTestId = 'match-key-grid',
  matchedOnly,
}: Props) {
  const [quickFilterText, setQuickFilterText] = useState('')

  const fullTotals = useMemo(() => columnTotals(rows), [rows])
  const displayRows = useMemo(
    () => (matchedOnly ? rows.filter((r) => nonEmptyTrimmed(r.matchedCompany)) : rows),
    [rows, matchedOnly],
  )
  const totals = useMemo(() => columnTotals(displayRows), [displayRows])

  const columnDefs = useMemo<ColDef<MatchKeyGridRow>[]>(
    () => [
      {
        field: 'contactCompany',
        headerName: 'Contact company',
        sortable: true,
        resizable: true,
        minWidth: 160,
        flex: 1,
        comparator: (a, b) => compareTrimmedLower(String(a ?? ''), String(b ?? '')),
      },
      {
        field: 'crmCompany',
        headerName: 'CRM company',
        sortable: true,
        resizable: true,
        minWidth: 160,
        flex: 1,
        comparator: (a, b) => compareTrimmedLower(String(a ?? ''), String(b ?? '')),
      },
      {
        field: 'matchedCompany',
        headerName: 'Matched company',
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
    [],
  )

  const defaultColDef = useMemo<ColDef<MatchKeyGridRow>>(
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
          placeholder="Filter rows (search all columns)…"
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
      <Box
        sx={{
          flexShrink: 0,
          px: 1.5,
          py: 0.75,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          gap: { xs: 0.75, sm: 2 },
        }}
        data-testid={`${dataTestId}-column-totals`}
      >
        <Typography component="span" variant="caption" color="text.secondary">
          Contact company:{' '}
          <Typography component="span" variant="caption" fontWeight={600} color="text.primary">
            {totals.contactCompany.toLocaleString()}
          </Typography>
        </Typography>
        <Typography component="span" variant="caption" color="text.secondary">
          CRM company:{' '}
          <Typography component="span" variant="caption" fontWeight={600} color="text.primary">
            {totals.crmCompany.toLocaleString()}
          </Typography>
        </Typography>
        <Typography component="span" variant="caption" color="text.secondary">
          Matched company:{' '}
          <Typography component="span" variant="caption" fontWeight={600} color="text.primary">
            {totals.matchedCompany.toLocaleString()}
          </Typography>
        </Typography>
        <Typography component="span" variant="caption" color="text.secondary">
          Parent company:{' '}
          <Typography component="span" variant="caption" fontWeight={600} color="text.primary">
            {totals.parentCompany.toLocaleString()}
          </Typography>
        </Typography>
      </Box>
      <Box sx={{ flexShrink: 0, px: 1.5, pb: 0.75 }} data-testid={`${dataTestId}-filter-hint`}>
        <Typography variant="caption" color="text.secondary" component="div">
          {matchedOnly ? (
            <>
              Showing {displayRows.length.toLocaleString()} row
              {displayRows.length !== 1 ? 's' : ''} with a non-empty Matched company (of{' '}
              {rows.length.toLocaleString()} total in this snapshot). Use{' '}
              <Box component="span" fontWeight={600}>
                Show all rows
              </Box>{' '}
              in the top header to see the full list again.
            </>
          ) : (
            <>
              {fullTotals.matchedCompany.toLocaleString()} row{fullTotals.matchedCompany !== 1 ? 's' : ''} have a
              matched company. Use <Box component="span" fontWeight={600}>Matched rows only</Box> in the top header to
              hide rows where Matched company is blank.
            </>
          )}
        </Typography>
      </Box>
      <div
        className="ag-theme-alpine"
        style={
          fillContainer ? { flex: 1, minHeight: 160, width: '100%' } : { height: gridHeight, width: '100%' }
        }
        data-testid={`${dataTestId}-ag`}
      >
        <AgGridReact<MatchKeyGridRow>
          rowData={displayRows}
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
