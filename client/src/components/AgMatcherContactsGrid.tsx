/**
 * @file AgMatcherContactsGrid.tsx
 * @description AG Grid matcher preview: contact columns plus import company + MUI match dropdown; filterable and resizable.
 * @module List-O-Matic-2000/client
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-community'
import SearchIcon from '@mui/icons-material/Search'
import { Box, InputAdornment, Paper, TextField, Typography, MenuItem } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import type { ContactRow } from '../utils/parseFile'
import type { MatcherSelectionProvenance } from './MatcherReviewPanel'

const ROW_HEIGHT = 52
const MIN_COL_PX = 72
const DEFAULT_FIELD = 130
const DEFAULT_IMPORT = 200
const DEFAULT_MATCH = 260
const SKIP_VALUE = ''
const PLACEHOLDER_LABEL = 'Select Company…'

export type MatcherMatchGridContext = {
  companyColumnKey: string
  selection: Record<string, string>
  provenanceByRaw: Record<string, MatcherSelectionProvenance>
  onSelectionChange: (raw: string, value: string) => void
  canonicalNamesSorted: string[]
  /** Re-paint match cells after a selection change (other rows may share the same raw company). */
  requestMatchColumnRefresh: () => void
}

function compareTrimmedLower(a: string, b: string): number {
  const aa = a.trim().toLowerCase()
  const bb = b.trim().toLowerCase()
  if (aa < bb) return -1
  if (aa > bb) return 1
  return 0
}

function MatcherMatchCellRenderer(
  params: ICellRendererParams<ContactRow, unknown, MatcherMatchGridContext>,
) {
  const ctx = params.context
  const data = params.data
  if (!ctx?.companyColumnKey || !data) return null

  const raw = String(data[ctx.companyColumnKey] ?? '').trim()
  const stored = ctx.selection[raw]
  const value = stored === undefined ? SKIP_VALUE : stored
  const provenance = ctx.provenanceByRaw[raw]
  const showFallbackOutline = provenance === 'deterministic'
  const isExplicitSkip = stored === SKIP_VALUE && provenance === 'manual'
  const needsPlaceholder =
    stored === undefined || (stored === SKIP_VALUE && provenance !== 'manual')

  return (
    <TextField
      select
      size="small"
      fullWidth
      value={value}
      data-provenance={provenance ?? ''}
      data-testid="matcher-match-select"
      data-match-display={needsPlaceholder ? 'placeholder' : isExplicitSkip ? 'skip' : 'company'}
      onChange={(e) => {
        ctx.onSelectionChange(raw, e.target.value)
        ctx.requestMatchColumnRefresh()
      }}
      SelectProps={{
        displayEmpty: true,
        renderValue: (selected) => {
          if (needsPlaceholder) {
            return (
              <Typography component="span" variant="body2" color="text.secondary">
                {PLACEHOLDER_LABEL}
              </Typography>
            )
          }
          if (selected === SKIP_VALUE && isExplicitSkip) {
            return (
              <Typography component="span" variant="body2">
                <em>— Skip —</em>
              </Typography>
            )
          }
          return selected as string
        },
        MenuProps: {
          disablePortal: false,
          slotProps: {
            paper: {
              sx: { maxHeight: 320, zIndex: 1700 },
            },
          },
        },
      }}
      sx={{
        ...(showFallbackOutline
          ? {
              outline: '2px solid',
              outlineColor: 'error.main',
              outlineOffset: 2,
              borderRadius: 1,
            }
          : {}),
        '& .MuiSelect-select': { py: 0.75, overflow: 'hidden', textOverflow: 'ellipsis' },
      }}
    >
      <MenuItem value={SKIP_VALUE}>
        <em>— Skip —</em>
      </MenuItem>
      {ctx.canonicalNamesSorted.map((name) => (
        <MenuItem key={name} value={name}>
          {name}
        </MenuItem>
      ))}
    </TextField>
  )
}

type Props = {
  contacts: ContactRow[]
  headers: string[]
  companyColumnKey: string | null
  /** Canonical company names from the companies import (`Name` column); dropdown options only. */
  canonicalNames: string[]
  selection: Record<string, string>
  selectionProvenance: Record<string, MatcherSelectionProvenance>
  onSelectionChange: (raw: string, value: string) => void
  maxHeight?: number
  fillContainer?: boolean
}

export function AgMatcherContactsGrid({
  contacts,
  headers,
  companyColumnKey,
  canonicalNames,
  selection,
  selectionProvenance,
  onSelectionChange,
  maxHeight = 520,
  fillContainer = false,
}: Props) {
  const theme = useTheme()
  const [quickFilterText, setQuickFilterText] = useState('')
  const gridApiRef = useRef<GridApi<ContactRow> | null>(null)

  const sortedCanon = useMemo(
    () => [...canonicalNames].sort((a, b) => a.localeCompare(b)),
    [canonicalNames],
  )

  const onGridReady = useCallback((e: GridReadyEvent<ContactRow>) => {
    gridApiRef.current = e.api
  }, [])

  const requestMatchColumnRefresh = useCallback(() => {
    queueMicrotask(() => {
      gridApiRef.current?.refreshCells({ columns: ['match_company'], force: true })
    })
  }, [])

  const gridContext = useMemo<MatcherMatchGridContext>(
    () => ({
      companyColumnKey: companyColumnKey ?? '',
      selection,
      provenanceByRaw: selectionProvenance,
      onSelectionChange,
      canonicalNamesSorted: sortedCanon,
      requestMatchColumnRefresh,
    }),
    [companyColumnKey, selection, selectionProvenance, onSelectionChange, sortedCanon, requestMatchColumnRefresh],
  )

  useEffect(() => {
    gridApiRef.current?.refreshCells({ columns: ['match_company'], force: true })
  }, [selection, selectionProvenance])

  const columnDefs = useMemo<ColDef<ContactRow>[]>(() => {
    if (!companyColumnKey) return []
    const muted = theme.palette.text.secondary
    const defs: ColDef<ContactRow>[] = []

    for (const h of headers) {
      if (h === companyColumnKey) {
        defs.push({
          colId: `matcher_import_${h}`,
          headerName: `${h} (import)`,
          valueGetter: (p) => String(p.data?.[h] ?? ''),
          sortable: true,
          resizable: true,
          minWidth: MIN_COL_PX,
          width: DEFAULT_IMPORT,
          comparator: (a, b) => compareTrimmedLower(String(a ?? ''), String(b ?? '')),
          cellStyle: { color: muted },
        })
        defs.push({
          colId: 'match_company',
          headerName: 'Company',
          sortable: false,
          filter: false,
          floatingFilter: false,
          resizable: true,
          minWidth: MIN_COL_PX,
          width: DEFAULT_MATCH,
          cellRenderer: MatcherMatchCellRenderer,
        })
      } else {
        defs.push({
          colId: `field_${h}`,
          field: h,
          headerName: h,
          sortable: true,
          resizable: true,
          comparator: (valueA, valueB) =>
            compareTrimmedLower(String(valueA ?? ''), String(valueB ?? '')),
          minWidth: MIN_COL_PX,
          width: h === 'Parent company' ? 220 : DEFAULT_FIELD,
        })
      }
    }
    return defs
  }, [headers, companyColumnKey, theme.palette.text.secondary])

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
  const outerTarget = Math.max(200, maxHeight)
  const gridHeight = Math.max(160, outerTarget - quickFilterBarHeight)

  if (!headers.length || !companyColumnKey) {
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
      data-testid="matcher-preview-table"
    >
      <Box sx={{ flexShrink: 0, px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Filter rows (search all columns)…"
          value={quickFilterText}
          onChange={(e) => setQuickFilterText(e.target.value)}
          data-testid="matcher-grid-quick-filter"
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
        data-testid="matcher-grid"
      >
        <AgGridReact<ContactRow>
          rowData={contacts}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          context={gridContext}
          quickFilterText={quickFilterText}
          rowHeight={ROW_HEIGHT}
          animateRows={false}
          domLayout="normal"
          onGridReady={onGridReady}
        />
      </div>
    </Paper>
  )
}
