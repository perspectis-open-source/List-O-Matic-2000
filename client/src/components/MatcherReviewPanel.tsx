/**
 * @file MatcherReviewPanel.tsx
 * @description Contact Company Matcher: full contact list with import company + match dropdown columns; resizable widths.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Alert,
  LinearProgress,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import FilterListIcon from '@mui/icons-material/FilterList'
import DownloadIcon from '@mui/icons-material/Download'
import { AgMatcherContactsGrid, type MatcherMatchExplain } from './AgMatcherContactsGrid'
import type { ContactRow } from '../utils/parseFile'
import { buildMatcherTableExport } from '../utils/companyMatch'
import { downloadCsv } from '../utils/exportCsv'
import { batchProgressBlue, parseBatchLinePrefix } from '../utils/matcherLogHighlight'

export type MatcherRowModel = {
  raw: string
  source: 'ambiguous' | 'llm'
  contactCount: number
  suggested: string | null
  optionHints: string[]
}

export type MatcherPhaseSlice = { completed: number; total: number; cached?: boolean }

/** HTTP batch progress plus optional server-side three-step pipeline slices (one HTTP request). */
export type MatcherLlmProgress = {
  completed: number
  total: number
  server?: {
    step1?: MatcherPhaseSlice
    step2?: MatcherPhaseSlice
    step3?: { done: boolean; detail?: string }
    fallback?: MatcherPhaseSlice
  }
}

export type MatcherSelectionProvenance = 'llm' | 'manual'

function splitMatcherLogTimestamp(line: string): { stamp: string; rest: string } | null {
  const m = line.match(/^(\[[^\]]+\])\s+(.*)$/)
  if (!m) return null
  return { stamp: m[1], rest: m[2] }
}

/**
 * Highlight per-batch token totals ("Tokens this request: …"), entire-run line
 * ("LLM tokens (entire matcher run): … total — … prompt + … completion."), and cost estimates ("Est. $…").
 * Left-to-right: whichever pattern appears first wins each step.
 */
function highlightMatcherLogRest(text: string, tokensColor: string, usdColor: string): ReactNode {
  const tokenRe = /Tokens this request:\s*[\d,]+/
  /** Full sentence from App.tsx (em dash — before prompt count). */
  const entireRunRe =
    /LLM tokens \(entire matcher run\): \d[\d,]* total — \d[\d,]* prompt \+ \d[\d,]* completion\./
  const usdRe = /Est\.\s*(\$[\d,]+(?:\.\d+)?)/

  const nodes: ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    const tokenMatch = remaining.match(tokenRe)
    const entireRunMatch = remaining.match(entireRunRe)
    const usdMatch = remaining.match(usdRe)
    const tokenIdx = tokenMatch ? remaining.indexOf(tokenMatch[0]) : -1
    const entireRunIdx = entireRunMatch ? remaining.indexOf(entireRunMatch[0]) : -1
    const usdIdx = usdMatch ? remaining.indexOf(usdMatch[0]) : -1

    type Pick = 'token' | 'entireRun' | 'usd' | 'none'
    let pick: Pick = 'none'
    let bestIdx = Infinity
    if (tokenIdx !== -1 && tokenIdx < bestIdx) {
      pick = 'token'
      bestIdx = tokenIdx
    }
    if (entireRunIdx !== -1 && entireRunIdx < bestIdx) {
      pick = 'entireRun'
      bestIdx = entireRunIdx
    }
    if (usdIdx !== -1 && usdIdx < bestIdx) {
      pick = 'usd'
      bestIdx = usdIdx
    }

    if (pick === 'none') {
      nodes.push(remaining)
      break
    }

    if (pick === 'token') {
      nodes.push(remaining.slice(0, tokenIdx))
      nodes.push(
        <Box component="span" key={`tok-${key++}`} sx={{ color: tokensColor, fontWeight: 600 }}>
          {tokenMatch![0]}
        </Box>,
      )
      remaining = remaining.slice(tokenIdx + tokenMatch![0].length)
    } else if (pick === 'entireRun') {
      nodes.push(remaining.slice(0, entireRunIdx))
      nodes.push(
        <Box component="span" key={`run-${key++}`} sx={{ color: tokensColor, fontWeight: 600 }}>
          {entireRunMatch![0]}
        </Box>,
      )
      remaining = remaining.slice(entireRunIdx + entireRunMatch![0].length)
    } else {
      const full = usdMatch![0]
      nodes.push(remaining.slice(0, usdIdx))
      nodes.push(
        <Box component="span" key={`usd-${key++}`} sx={{ color: usdColor, fontWeight: 600 }}>
          {full}
        </Box>,
      )
      remaining = remaining.slice(usdIdx + full.length)
    }
  }

  if (nodes.length === 0) return text
  return nodes.length === 1 ? nodes[0] : <>{nodes}</>
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
  selectionProvenance: Record<string, MatcherSelectionProvenance>
  llmProgress: MatcherLlmProgress | null
  /** True while a batch HTTP request is in flight (model may still be working on the server). */
  httpWaiting: boolean
  /** Timestamped lines from the current / last matcher run. */
  runLog: string[]
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
  runLog,
  matcherParentByRaw,
  matcherParentByCanon,
  onSelectionChange,
  onRun,
}: MatcherReviewPanelProps) {
  const theme = useTheme()
  /** Deep green in light mode (readable on pale backgrounds); neon in dark mode. */
  const logTimestampColor = theme.palette.mode === 'light' ? '#166534' : '#39ff14'
  /** Blue for "Tokens this request: …", batch /total, and end of Batch i ramp (darker for contrast). */
  const logTokensColor = theme.palette.mode === 'light' ? '#1e40af' : '#2563eb'
  /** Red for estimated USD in log lines (readable in light and dark). */
  const logCostColor = theme.palette.mode === 'light' ? '#b91c1c' : '#f87171'

  const renderMatcherLogRest = useCallback(
    (rest: string) => {
      const batch = parseBatchLinePrefix(rest)
      if (batch) {
        const batchBlue = batchProgressBlue(
          batch.batchIndex,
          batch.batchTotal,
          logTokensColor,
          theme.palette.mode,
        )
        return (
          <>
            <Box component="span" sx={{ color: batchBlue, fontWeight: 600 }}>
              Batch {batch.batchIndex}
            </Box>
            <Box component="span" sx={{ color: logTokensColor, fontWeight: 600 }}>
              /{batch.batchTotal}:{' '}
            </Box>
            {highlightMatcherLogRest(batch.tail, logTokensColor, logCostColor)}
          </>
        )
      }
      return highlightMatcherLogRest(rest, logTokensColor, logCostColor)
    },
    [logTokensColor, logCostColor, theme.palette.mode],
  )

  const showTable = contacts.length > 0 && headers.length > 0 && companyColumnKey != null
  const logEndRef = useRef<HTMLDivElement>(null)
  const runStartedAtRef = useRef<number | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [lastRunTotalSec, setLastRunTotalSec] = useState<number | null>(null)
  const [activityLogVisible, setActivityLogVisible] = useState(true)
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
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [runLog])

  useEffect(() => {
    if (running) setGridFilter('all')
  }, [running])

  useEffect(() => {
    if (!running) {
      setElapsedSec(0)
      return
    }
    setLastRunTotalSec(null)
    const t0 = Date.now()
    runStartedAtRef.current = t0
    setElapsedSec(0)
    const id = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - t0) / 1000))
    }, 500)
    return () => {
      window.clearInterval(id)
      if (runStartedAtRef.current != null) {
        setLastRunTotalSec(Math.floor((Date.now() - runStartedAtRef.current) / 1000))
        runStartedAtRef.current = null
      }
    }
  }, [running])

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const showProgress =
    running && ((llmProgress != null && llmProgress.total > 0) || httpWaiting)

  const showActivityPanel = runLog.length > 0 || running
  const serverStepsVisible = Boolean(
    llmProgress?.server &&
      (llmProgress.server.step1 ||
        llmProgress.server.step2 ||
        llmProgress.server.step3?.done ||
        (llmProgress.server.fallback && llmProgress.server.fallback.total > 0))
  )

  const activityPanelMaxHeight = 'min(40vh, 320px)'

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

      {showActivityPanel && activityLogVisible && (
        <Paper
          variant="outlined"
          data-testid="matcher-run-log"
          sx={{
            flexShrink: 0,
            p: 1,
            maxHeight: activityPanelMaxHeight,
            overflow: 'auto',
            borderRadius: 1,
            bgcolor: 'action.hover',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5, mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Activity
            </Typography>
            <Tooltip title="Hide activity and progress">
              <IconButton
                size="small"
                aria-label="Hide activity and progress"
                onClick={() => setActivityLogVisible(false)}
                data-testid="matcher-run-log-hide"
                sx={{ p: 0.25 }}
              >
                <ExpandLessIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          {showProgress && (
            <Box sx={{ flexShrink: 0, mb: 1 }}>
              <Typography variant="caption" color="text.secondary" data-testid="matcher-llm-progress-label">
                {running ? `Elapsed ${formatElapsed(elapsedSec)} · ` : ''}
                {llmProgress != null && llmProgress.total > 0
                  ? `HTTP batches ${llmProgress.completed} / ${llmProgress.total}`
                  : 'Contacting server…'}
                {httpWaiting ? ' · model running…' : ''}
              </Typography>
              {llmProgress != null && llmProgress.total > 0 && (
                <LinearProgress
                  variant="determinate"
                  value={(100 * llmProgress.completed) / llmProgress.total}
                  sx={{ mt: 0.5, borderRadius: 1 }}
                  data-testid="matcher-llm-progress"
                />
              )}
              {httpWaiting && (
                <LinearProgress
                  variant="indeterminate"
                  sx={{ mt: 0.75, borderRadius: 1, height: 4, opacity: 0.85 }}
                  data-testid="matcher-llm-progress-pending"
                />
              )}
              {serverStepsVisible &&
                (httpWaiting || running) &&
                llmProgress != null &&
                llmProgress.server != null && (
                <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }} data-testid="matcher-server-steps">
                  {llmProgress.server.step1 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {llmProgress.server.step1.cached
                          ? '① List rows — parent inference (cached)'
                          : `① List rows — parent inference (${llmProgress.server.step1.completed} / ${llmProgress.server.step1.total} model batches)`}
                      </Typography>
                      {!llmProgress.server.step1.cached && llmProgress.server.step1.total > 0 && (
                        <LinearProgress
                          variant="determinate"
                          value={
                            (100 * llmProgress.server.step1.completed) / Math.max(1, llmProgress.server.step1.total)
                          }
                          sx={{ mt: 0.25, borderRadius: 1, height: 4 }}
                        />
                      )}
                    </Box>
                  )}
                  {llmProgress.server.step2 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        ② Contact strings — parent inference ({llmProgress.server.step2.completed} /{' '}
                        {llmProgress.server.step2.total} model batches)
                      </Typography>
                      {llmProgress.server.step2.total > 0 && (
                        <LinearProgress
                          variant="determinate"
                          value={
                            (100 * llmProgress.server.step2.completed) / Math.max(1, llmProgress.server.step2.total)
                          }
                          sx={{ mt: 0.25, borderRadius: 1, height: 4 }}
                        />
                      )}
                    </Box>
                  )}
                  {llmProgress.server.step3?.done && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      ③ Match on parent labels — {llmProgress.server.step3.detail ?? 'done'}
                    </Typography>
                  )}
                  {llmProgress.server.fallback && llmProgress.server.fallback.total > 0 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        ④ Closed-list fallback ({llmProgress.server.fallback.completed} /{' '}
                        {llmProgress.server.fallback.total} model batches)
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={
                          (100 * llmProgress.server.fallback.completed) /
                          Math.max(1, llmProgress.server.fallback.total)
                        }
                        sx={{ mt: 0.25, borderRadius: 1, height: 4 }}
                      />
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          )}
          {runLog.map((line, i) => {
            const parts = splitMatcherLogTimestamp(line)
            return (
              <Typography
                key={`matcher-log-${i}`}
                component="div"
                variant="caption"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.7rem',
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: 'text.secondary',
                }}
              >
                {parts ? (
                  <>
                    <Box component="span" sx={{ color: logTimestampColor, fontWeight: 700 }}>
                      {parts.stamp}
                    </Box>{' '}
                    {renderMatcherLogRest(parts.rest)}
                  </>
                ) : (
                  line
                )}
              </Typography>
            )
          })}
          {!running && lastRunTotalSec !== null && runLog.length > 0 && (
            <Typography
              component="div"
              variant="caption"
              data-testid="matcher-run-log-total-time"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.7rem',
                lineHeight: 1.45,
                mt: 0.5,
                color: logTimestampColor,
                fontWeight: 700,
              }}
            >
              Total processing time: {formatElapsed(lastRunTotalSec)}
            </Typography>
          )}
          <div ref={logEndRef} />
        </Paper>
      )}

      {showActivityPanel && !activityLogVisible && (
        <Box sx={{ flexShrink: 0 }}>
          <Button
            size="small"
            variant="text"
            startIcon={<ExpandMoreIcon />}
            onClick={() => setActivityLogVisible(true)}
            data-testid="matcher-run-log-show"
            sx={{ alignSelf: 'flex-start', py: 0.25, px: 0.5, fontSize: '0.75rem' }}
          >
            Show activity & progress
          </Button>
        </Box>
      )}

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
