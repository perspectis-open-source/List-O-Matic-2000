/**
 * @file MatcherActivityLogSection.tsx
 * @description Collapsible matcher activity + HTTP / server-step progress + operational log list.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, IconButton, LinearProgress, Paper, Tooltip, Typography } from '@mui/material'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useTheme } from '@mui/material/styles'
import { IndeterminateLinearSweep } from '@syncsphere/vendor-shared/ui/indeterminate-linear-sweep'
import type { VendorActivityLogPalette } from '../platform/local/shared/vendorActivityLog/types'
import type { MatcherActivityLogEntry, MatcherLlmProgress } from './matcherStreamTypes'
import { CompanyMatchActivityLogLine } from './activityLog/CompanyMatchActivityLogLine'

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export type MatcherActivityLogSectionProps = {
  entries: MatcherActivityLogEntry[]
  running: boolean
  httpWaiting: boolean
  llmProgress: MatcherLlmProgress | null
  buildEvidenceUrl: (correlationId: string) => string
  /** Default `min(50vh, 420px)` — accordion evidence detail. */
  evidenceDetailMaxHeight?: string
  /** Default `min(40vh, 320px)` — outer activity Paper. */
  activityPanelMaxHeight?: string
}

export function MatcherActivityLogSection({
  entries,
  running,
  httpWaiting,
  llmProgress,
  buildEvidenceUrl,
  evidenceDetailMaxHeight,
  activityPanelMaxHeight = 'min(40vh, 320px)',
}: MatcherActivityLogSectionProps) {
  const theme = useTheme()
  const logEndRef = useRef<HTMLDivElement>(null)
  const runStartedAtRef = useRef<number | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [lastRunTotalSec, setLastRunTotalSec] = useState<number | null>(null)
  const [activityLogVisible, setActivityLogVisible] = useState(true)
  void buildEvidenceUrl
  void evidenceDetailMaxHeight

  const logTimestampColor = theme.palette.mode === 'light' ? '#166534' : '#39ff14'
  const logTokensColor = theme.palette.mode === 'light' ? '#1e40af' : '#2563eb'
  const logCostColor = theme.palette.mode === 'light' ? '#b91c1c' : '#f87171'

  const activityPalette: VendorActivityLogPalette = useMemo(
    () => ({
      stamp: logTimestampColor,
      tokens: logTokensColor,
      cost: logCostColor,
    }),
    [logTimestampColor, logTokensColor, logCostColor],
  )

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

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

  const showProgress = running && ((llmProgress != null && llmProgress.total > 0) || httpWaiting)
  const showActivityPanel = entries.length > 0 || running
  const serverStepsVisible = Boolean(
    llmProgress?.server &&
      (llmProgress.server.step1 ||
        llmProgress.server.step2 ||
        llmProgress.server.step3?.done ||
        (llmProgress.server.fallback && llmProgress.server.fallback.total > 0)),
  )

  return (
    <>
      {showActivityPanel && activityLogVisible && (
        <Paper
          variant="outlined"
          data-testid="matcher-run-log"
          sx={{
            flexShrink: 0,
            p: 1,
            maxHeight: activityPanelMaxHeight,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
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
            <Box sx={{ flexShrink: 0, mb: 1 }} data-testid="matcher-run-log-progress-block">
              <Typography variant="caption" color="text.secondary" data-testid="matcher-llm-progress-label">
                {running ? `Elapsed ${formatElapsed(elapsedSec)} · ` : ''}
                {llmProgress != null && llmProgress.total > 0
                  ? llmProgress.total === 1
                    ? `Matcher request ${llmProgress.completed} / ${llmProgress.total}`
                    : `HTTP batches ${llmProgress.completed} / ${llmProgress.total}`
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
                <IndeterminateLinearSweep
                  sx={{ mt: 0.75 }}
                  data-testid="matcher-llm-progress-pending"
                  aria-label="Model request in progress"
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
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }} data-testid="matcher-operational-log-list">
              {entries.map((entry, idx) => (
                <CompanyMatchActivityLogLine
                  key={`${idx}-${entry.correlationId ?? 'no-cid'}-${entry.line}`}
                  variant="log"
                  line={entry.line}
                  palette={activityPalette}
                  themeMode={theme.palette.mode}
                  showExpandAffordance={false}
                  dataTestId={`matcher-operational-log-line-${idx}`}
                />
              ))}
            </Box>
            {!running && lastRunTotalSec !== null && entries.length > 0 && (
              <CompanyMatchActivityLogLine
                variant="summary"
                palette={activityPalette}
                themeMode={theme.palette.mode}
                dataTestId="matcher-run-log-total-time"
                sx={{ mt: 0.5, flexShrink: 0 }}
              >
                Total processing time: {formatElapsed(lastRunTotalSec)}
              </CompanyMatchActivityLogLine>
            )}
            <div ref={logEndRef} />
          </Box>
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
    </>
  )
}
