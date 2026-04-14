/**
 * @file MatcherReviewPanel.tsx
 * @description Contact Company Matcher: full contact list with import company + match dropdown columns; resizable widths; Apply adds Matched Company column.
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
import CheckIcon from '@mui/icons-material/Check'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import FilterListIcon from '@mui/icons-material/FilterList'
import DownloadIcon from '@mui/icons-material/Download'
import { AgMatcherContactsGrid } from './AgMatcherContactsGrid'
import type { ContactRow } from '../utils/parseFile'
import { buildMatcherTableExport } from '../utils/companyMatch'
import { downloadCsv } from '../utils/exportCsv'
import { batchProgressBlue, parseBatchLinePrefix } from '../utils/matcherLogHighlight'

export type MatcherRowModel = {
  raw: string
  source: 'auto' | 'ambiguous' | 'llm' | 'deterministic_fallback'
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

export type MatcherSelectionProvenance = 'llm' | 'deterministic' | 'manual'

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
  selectionProvenance,
  llmProgress,
  httpWaiting,
  runLog,
  onSelectionChange,
  onRun,
  onApply,
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
  /** Show only contact rows whose import company string has no canonical match selected yet. */
  const [showUnmatchedOnly, setShowUnmatchedOnly] = useState(false)

  const unmatchedUniqueCount = useMemo(() => {
    if (!companyColumnKey) return 0
    const s = new Set<string>()
    for (const row of contacts) {
      const raw = String(row[companyColumnKey] ?? '').trim()
      if (raw !== '' && !(selection[raw]?.trim())) s.add(raw)
    }
    return s.size
  }, [contacts, companyColumnKey, selection])

  const contactsForGrid = useMemo(() => {
    if (!showUnmatchedOnly || !companyColumnKey) return contacts
    return contacts.filter((row) => {
      const raw = String(row[companyColumnKey] ?? '').trim()
      return raw !== '' && !(selection[raw]?.trim())
    })
  }, [contacts, companyColumnKey, selection, showUnmatchedOnly])

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
    if (running) setShowUnmatchedOnly(false)
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
        <Button
          variant="outlined"
          startIcon={<CheckIcon />}
          onClick={onApply}
          disabled={running || rows.length === 0}
          data-testid="matcher-apply-button"
        >
          Apply to contacts
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
              {serverStepsVisible && (httpWaiting || running) && (
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
            <Typography variant="subtitle2" color="primary" sx={{ minWidth: 0 }}>
              {showUnmatchedOnly
                ? `${contactsForGrid.length.toLocaleString()} of ${contacts.length.toLocaleString()} contact row${
                    contacts.length !== 1 ? 's' : ''
                  } (need match)`
                : `${contacts.length.toLocaleString()} contact${contacts.length !== 1 ? 's' : ''}`}{' '}
              — drag column edges to resize
            </Typography>
            {rows.length > 0 && (
              <Tooltip
                title={
                  showUnmatchedOnly
                    ? 'Show every contact row again.'
                    : unmatchedUniqueCount > 0
                      ? `Limit the grid to rows whose import company (${unmatchedUniqueCount} unique) has no match in the dropdown yet.`
                      : 'Every import company already has a match selected.'
                }
              >
                <span>
                  <Button
                    size="small"
                    variant={showUnmatchedOnly ? 'contained' : 'outlined'}
                    color={showUnmatchedOnly ? 'secondary' : 'primary'}
                    startIcon={<FilterListIcon sx={{ fontSize: 18 }} />}
                    onClick={() => setShowUnmatchedOnly((v) => !v)}
                    disabled={!showUnmatchedOnly && unmatchedUniqueCount === 0}
                    data-testid="matcher-filter-unmatched-only"
                    sx={{ flexShrink: 0, fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                  >
                    {showUnmatchedOnly
                      ? 'Show all rows'
                      : `Need match only (${unmatchedUniqueCount})`}
                  </Button>
                </span>
              </Tooltip>
            )}
          </Box>
          {showUnmatchedOnly && contactsForGrid.length === 0 && (
            <Typography variant="body2" color="success.main" sx={{ flexShrink: 0 }}>
              Every import company has a match selected — nothing left to filter.
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
              onSelectionChange={onSelectionChange}
              fillContainer
            />
          </Box>
        </Box>
      )}
    </Box>
  )
}
