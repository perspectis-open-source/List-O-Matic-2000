/**
 * @file MatcherReviewPanel.tsx
 * @description Contact Company Matcher: full contact list with import company + match dropdown columns; resizable widths; Apply adds Matched Company column.
 */
import { Box, Button, Typography, CircularProgress, Alert } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CheckIcon from '@mui/icons-material/Check'
import { AgMatcherContactsGrid } from './AgMatcherContactsGrid'
import type { ContactRow } from '../utils/parseFile'

export type MatcherRowModel = {
  raw: string
  source: 'auto' | 'ambiguous' | 'llm'
  contactCount: number
  suggested: string | null
  optionHints: string[]
}

type MatcherReviewPanelProps = {
  canRun: boolean
  running: boolean
  error: string | null
  onDismissError: () => void
  contacts: ContactRow[]
  headers: string[]
  companyColumnKey: string | null
  rows: MatcherRowModel[]
  canonicalNames: string[]
  selection: Record<string, string>
  onSelectionChange: (raw: string, value: string) => void
  onRun: () => void
  onApply: () => void
}

export function MatcherReviewPanel({
  canRun,
  running,
  error,
  onDismissError,
  contacts,
  headers,
  companyColumnKey,
  rows,
  canonicalNames,
  selection,
  onSelectionChange,
  onRun,
  onApply,
}: MatcherReviewPanelProps) {
  const showTable = contacts.length > 0 && headers.length > 0 && companyColumnKey != null

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Each row lists your file columns; <strong>{companyColumnKey ?? 'company'} (import)</strong> is the value from the
        file. Choose <strong>Match to company list</strong> per row (all rows with the same import value share one
        mapping). Drag the right edge of a column header to resize.{' '}
        <strong>Apply to contacts</strong> writes the selection to the <strong>Matched Company</strong> column.
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2, alignItems: 'center' }}>
        <Button
          variant="contained"
          startIcon={running ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
          onClick={onRun}
          disabled={!canRun || running}
          data-testid="matcher-run-button"
        >
          {running ? 'Running…' : 'Run matcher'}
        </Button>
        <Button
          variant="outlined"
          startIcon={<CheckIcon />}
          onClick={onApply}
          disabled={running || rows.length === 0}
          data-testid="matcher-apply-button"
        >
          Apply to contacts
        </Button>
      </Box>

      {error && (
        <Alert severity="error" onClose={onDismissError} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {rows.length === 0 && !running && (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Click <strong>Run matcher</strong> to fill match suggestions from fuzzy + LLM (
          {canRun ? 'ready' : 'import contacts and companies with a company column first'}).
        </Typography>
      )}

      {showTable && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
            {contacts.length.toLocaleString()} contact{contacts.length !== 1 ? 's' : ''} — drag column edges to resize
          </Typography>
          <AgMatcherContactsGrid
            contacts={contacts}
            headers={headers}
            companyColumnKey={companyColumnKey}
            canonicalNames={canonicalNames}
            selection={selection}
            onSelectionChange={onSelectionChange}
            maxHeight={520}
          />
        </Box>
      )}
    </Box>
  )
}
