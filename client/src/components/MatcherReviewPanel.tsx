/**
 * @file MatcherReviewPanel.tsx
 * @description Contact Company Matcher: full contact list with import company + match dropdown columns; resizable widths.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Button, Typography, CircularProgress, Alert, Tooltip } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import FilterListIcon from '@mui/icons-material/FilterList'
import DownloadIcon from '@mui/icons-material/Download'
import { AgMatcherContactsGrid, type MatcherMatchExplain } from './AgMatcherContactsGrid'
import type { ContactRow } from '../utils/parseFile'
import { buildMatcherTableExport } from '../utils/companyMatch'
import { downloadCsv } from '../utils/exportCsv'
import { MatcherActivityLogSection } from '../matcher/MatcherActivityLogSection'
import type { MatcherActivityLogEntry, MatcherLlmProgress } from '../matcher/matcherStreamTypes'

export type MatcherRowModel = {
  raw: string
  source: 'ambiguous' | 'llm'
  contactCount: number
  suggested: string | null
  optionHints: string[]
}

export type { MatcherLlmProgress, MatcherPhaseSlice } from '../matcher/matcherStreamTypes'

export type MatcherSelectionProvenance = 'llm' | 'manual'

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
  selectionProvenance: Record<string, MatcherSelectionProvenance>
  llmProgress: MatcherLlmProgress | null
  /** True while a batch HTTP request is in flight (model may still be working on the server). */
  httpWaiting: boolean
  /** Structured activity log lines (optional `correlationId` for evidence expand). */
  activityLogEntries: MatcherActivityLogEntry[]
  buildEvidenceUrl: (correlationId: string) => string
  /** Inferred parent per unique contact import string (after matcher / keybook). */
  matcherParentByRaw?: Record<string, string>
  /** Inferred parent per companies-file canonical `Name`. */
  matcherParentByCanon?: Record<string, string>
  onSelectionChange: (raw: string, value: string) => void
  onRun: () => void
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
  selectionProvenance,
  llmProgress,
  httpWaiting,
  activityLogEntries,
  buildEvidenceUrl,
  matcherParentByRaw,
  matcherParentByCanon,
  onSelectionChange,
  onRun,
}: MatcherReviewPanelProps) {
  const showTable = contacts.length > 0 && headers.length > 0 && companyColumnKey != null
  /** Grid row filter: all contacts, only those still needing a list match, or only those with a valid list match. */
  const [gridFilter, setGridFilter] = useState<'all' | 'matched' | 'unmatched'>('all')

  const unmatchedUniqueCount = useMemo(() => {
    if (!companyColumnKey) return 0
    const s = new Set<string>()
    for (const row of contacts) {
      const raw = String(row[companyColumnKey] ?? '').trim()
      if (raw !== '' && !(selection[raw]?.trim())) s.add(raw)
    }
    return s.size
  }, [contacts, companyColumnKey, selection])

  const canonSet = useMemo(() => new Set(canonicalNames), [canonicalNames])

  /** Per unique import string (matcher row), plus contact-row coverage. */
  const matchStats = useMemo(() => {
    let uniqueMatched = 0
    let byLlm = 0
    let byManual = 0
    let byOther = 0
    for (const row of rows) {
      const sel = selection[row.raw]?.trim() ?? ''
      if (!sel || !canonSet.has(sel)) continue
      uniqueMatched++
      const p = selectionProvenance[row.raw]
      if (p === 'llm') byLlm++
      else if (p === 'manual') byManual++
      else byOther++
    }
    const uniqueTotal = rows.length
    const uniqueUnmatched = uniqueTotal - uniqueMatched

    let contactRowsMatched = 0
    if (companyColumnKey) {
      for (const c of contacts) {
        const raw = String(c[companyColumnKey] ?? '').trim()
        if (!raw) continue
        const sel = selection[raw]?.trim() ?? ''
        if (sel && canonSet.has(sel)) contactRowsMatched++
      }
    }
    return {
      uniqueTotal,
      uniqueMatched,
      uniqueUnmatched,
      byLlm,
      byManual,
      byOther,
      contactRowsMatched,
      contactRowsTotal: contacts.length,
    }
  }, [rows, selection, selectionProvenance, canonSet, contacts, companyColumnKey])

  const matchExplainByRaw = useMemo(() => {
    const m: Record<string, MatcherMatchExplain> = {}
    for (const row of rows) {
      m[row.raw] = {
        source: row.source,
        suggested: row.suggested,
        optionHints: row.optionHints,
        contactCount: row.contactCount,
      }
    }
    return m
  }, [rows])

  const contactsForGrid = useMemo(() => {
    if (!companyColumnKey) return contacts
    if (gridFilter === 'unmatched') {
      return contacts.filter((row) => {
        const raw = String(row[companyColumnKey] ?? '').trim()
        return raw !== '' && !(selection[raw]?.trim())
      })
    }
    if (gridFilter === 'matched') {
      return contacts.filter((row) => {
        const raw = String(row[companyColumnKey] ?? '').trim()
        const sel = selection[raw]?.trim() ?? ''
        return raw !== '' && sel !== '' && canonSet.has(sel)
      })
    }
    return contacts
  }, [contacts, companyColumnKey, selection, gridFilter, canonSet])

  const handleExportTable = useCallback(() => {
    if (!companyColumnKey || contactsForGrid.length === 0) return
    const { data, csvHeaders } = buildMatcherTableExport(
      contactsForGrid,
      headers,
      companyColumnKey,
      selection
    )
    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(data, csvHeaders, `matcher-table-${date}.csv`)
  }, [contactsForGrid, headers, companyColumnKey, selection])

  useEffect(() => {
    if (running) setGridFilter('all')
  }, [running])

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <Button
          variant="contained"
          startIcon={running ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
          onClick={onRun}
          disabled={!canRun || running}
          data-testid="matcher-run-button"
        >
          {running ? 'Running…' : 'Run matcher'}
        </Button>
        <Tooltip title="Download the current grid as CSV (same rows as shown; includes match selections).">
          <span>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExportTable}
              disabled={running || !showTable || contactsForGrid.length === 0}
              data-testid="matcher-export-table-button"
            >
              Export table
            </Button>
          </span>
        </Tooltip>
      </Box>

      <MatcherActivityLogSection
        entries={activityLogEntries}
        running={running}
        httpWaiting={httpWaiting}
        llmProgress={llmProgress}
        buildEvidenceUrl={buildEvidenceUrl}
      />

      {error && (
        <Alert severity="error" onClose={onDismissError} sx={{ flexShrink: 0 }}>
          {error}
        </Alert>
      )}

      {rows.length === 0 && !running && (
        <Typography color="text.secondary" sx={{ flexShrink: 0 }}>
          Click <strong>Run matcher</strong> to fill match suggestions using the LLM against your company list (
          {canRun ? 'ready' : 'import contacts and companies with a company column first'}).
        </Typography>
      )}

      {showTable && (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1,
              flexShrink: 0,
            }}
          >
            <Box sx={{ minWidth: 0, flex: '1 1 200px' }}>
              <Typography variant="subtitle2" color="primary" sx={{ minWidth: 0 }}>
                {gridFilter === 'unmatched'
                  ? `${contactsForGrid.length.toLocaleString()} of ${contacts.length.toLocaleString()} contact row${
                      contacts.length !== 1 ? 's' : ''
                    } (need match)`
                  : gridFilter === 'matched'
                    ? `${contactsForGrid.length.toLocaleString()} of ${contacts.length.toLocaleString()} contact row${
                        contacts.length !== 1 ? 's' : ''
                      } (matched only)`
                    : `${contacts.length.toLocaleString()} contact${contacts.length !== 1 ? 's' : ''}`}{' '}
                — drag column edges to resize
              </Typography>
              {rows.length > 0 && (
                <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
                  Unique import strings: {matchStats.uniqueMatched.toLocaleString()} of{' '}
                  {matchStats.uniqueTotal.toLocaleString()} matched (
                  {matchStats.byLlm.toLocaleString()} model, {matchStats.byManual.toLocaleString()} manual
                  {matchStats.byOther > 0 ? `, ${matchStats.byOther.toLocaleString()} other` : ''};{' '}
                  {matchStats.uniqueUnmatched.toLocaleString()} open).
                  Contact rows with a list match: {matchStats.contactRowsMatched.toLocaleString()} of{' '}
                  {matchStats.contactRowsTotal.toLocaleString()}.
                </Typography>
              )}
            </Box>
            {rows.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center', flexShrink: 0 }}>
                <Tooltip
                  title={
                    gridFilter === 'matched'
                      ? 'Show every contact row again.'
                      : matchStats.contactRowsMatched > 0
                        ? `Show only rows whose company has a valid list Name selected (${matchStats.contactRowsMatched.toLocaleString()} row${matchStats.contactRowsMatched !== 1 ? 's' : ''}).`
                        : 'No rows have a valid list match in the dropdown yet.'
                  }
                >
                  <span>
                    <Button
                      size="small"
                      variant={gridFilter === 'matched' ? 'contained' : 'outlined'}
                      color={gridFilter === 'matched' ? 'secondary' : 'primary'}
                      startIcon={<FilterListIcon sx={{ fontSize: 18 }} />}
                      onClick={() => setGridFilter((f) => (f === 'matched' ? 'all' : 'matched'))}
                      disabled={gridFilter !== 'matched' && matchStats.contactRowsMatched === 0}
                      data-testid="matcher-filter-matched-only"
                      sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                    >
                      {gridFilter === 'matched'
                        ? 'Show all rows'
                        : `Matched only (${matchStats.contactRowsMatched.toLocaleString()})`}
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip
                  title={
                    gridFilter === 'unmatched'
                      ? 'Show every contact row again.'
                      : unmatchedUniqueCount > 0
                        ? `Limit the grid to rows whose import company (${unmatchedUniqueCount} unique) has no match in the dropdown yet.`
                        : 'Every import company already has a match selected.'
                  }
                >
                  <span>
                    <Button
                      size="small"
                      variant={gridFilter === 'unmatched' ? 'contained' : 'outlined'}
                      color={gridFilter === 'unmatched' ? 'secondary' : 'primary'}
                      startIcon={<FilterListIcon sx={{ fontSize: 18 }} />}
                      onClick={() => setGridFilter((f) => (f === 'unmatched' ? 'all' : 'unmatched'))}
                      disabled={gridFilter !== 'unmatched' && unmatchedUniqueCount === 0}
                      data-testid="matcher-filter-unmatched-only"
                      sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                    >
                      {gridFilter === 'unmatched'
                        ? 'Show all rows'
                        : `Need match only (${unmatchedUniqueCount})`}
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            )}
          </Box>
          {gridFilter === 'unmatched' && contactsForGrid.length === 0 && (
            <Typography variant="body2" color="success.main" sx={{ flexShrink: 0 }}>
              Every import company has a match selected — nothing left to filter.
            </Typography>
          )}
          {gridFilter === 'matched' && contactsForGrid.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
              No contact rows have a valid companies-list match selected yet.
            </Typography>
          )}
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <AgMatcherContactsGrid
              contacts={contactsForGrid}
              headers={headers}
              companyColumnKey={companyColumnKey}
              canonicalNames={canonicalNames}
              selection={selection}
              selectionProvenance={selectionProvenance}
              matchExplainByRaw={matchExplainByRaw}
              matcherParentByRaw={matcherParentByRaw}
              matcherParentByCanon={matcherParentByCanon}
              onSelectionChange={onSelectionChange}
              fillContainer
            />
          </Box>
        </Box>
      )}
    </Box>
  )
}
