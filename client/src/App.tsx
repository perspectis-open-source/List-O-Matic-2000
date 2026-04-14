/**
 * @file App.tsx
 * @description Main application: tabs (Contacts, Companies, Normalizer, Matcher), upload, company select, and results tools.
 * @module List-O-Matic-2000/client
 */
import { useState, useCallback, useMemo, useRef } from 'react'
import {
  ThemeProvider,
  CssBaseline,
  Box,
  Button,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Alert,
  Container,
  CircularProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { keyframes } from '@mui/system'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import SearchIcon from '@mui/icons-material/Search'
import DownloadIcon from '@mui/icons-material/Download'
import { getAppTheme } from './theme'
import { parseContactFile, parseCompanyFile, type ContactRow, type CompanyRow } from './utils/parseFile'
import { downloadCsv, sanitizeFilenameSegment } from './utils/exportCsv'
import { UploadDropZone, type UploadImportKind } from './components/UploadDropZone'
import { AgContactsGrid } from './components/AgContactsGrid'
import { AgCompaniesGrid } from './components/AgCompaniesGrid'
import { CompanySelect } from './components/CompanySelect'
import { postChat, type ReasoningStep } from './api/chat'
import { postMatchCompaniesBatched, type MatchCompaniesUsageTotals } from './api/matchCompanies'
import { CrmExportFeature } from './components/CrmExportFeature'
import {
  MatcherReviewPanel,
  type MatcherRowModel,
  type MatcherLlmProgress,
  type MatcherSelectionProvenance,
} from './components/MatcherReviewPanel'
import { MATCH_MATCHER_CLIENT_BATCH_SIZE } from './constants/companyMatch'
import {
  estimateOpenAiChatCostUsd,
  formatUsdEstimate,
  MATCH_COMPANIES_OPENAI_MODEL,
} from './constants/openaiPricing'
import { canonicalNamesFromCompanies, matchDeterministicBatch, pickMatchedCompanyHeader } from './utils/companyMatch'

type TabValue = 'contacts' | 'companies' | 'normalizer' | 'matcher'

const logShimmer = keyframes`
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
`

function AppContent({ mode, onToggleMode }: { mode: 'light' | 'dark'; onToggleMode: () => void }) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadImportKind, setUploadImportKind] = useState<UploadImportKind>('contacts')
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [companyColumnKey, setCompanyColumnKey] = useState<string | null>(null)
  const [entityColumnKey, setEntityColumnKey] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [companyHeaders, setCompanyHeaders] = useState<string[]>([])
  const [companyFileName, setCompanyFileName] = useState<string | null>(null)
  const [companyParseError, setCompanyParseError] = useState<string | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null)
  const [companyInputValue, setCompanyInputValue] = useState('')
  const [matchingCompanyNames, setMatchingCompanyNames] = useState<string[]>([])
  const [excludedMatchNames, setExcludedMatchNames] = useState<string[]>([])
  const [inferredParentCompany, setInferredParentCompany] = useState<string | null>(null)
  const [overrideCompanyName, setOverrideCompanyName] = useState<string | null>(null)
  const [companyNameOverrideInput, setCompanyNameOverrideInput] = useState('')
  const [activeTab, setActiveTab] = useState<TabValue>('contacts')
  const [aiSearchLoading, setAiSearchLoading] = useState(false)
  const [aiSearchError, setAiSearchError] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [reasoningSteps, setReasoningSteps] = useState<ReasoningStep[] | null>(null)
  const [persistedAiResultRows, setPersistedAiResultRows] = useState<ContactRow[] | null>(null)
  const [processLogLines, setProcessLogLines] = useState<string[]>([])
  const processLogIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [matcherRunning, setMatcherRunning] = useState(false)
  const [matcherError, setMatcherError] = useState<string | null>(null)
  const [matcherRows, setMatcherRows] = useState<MatcherRowModel[]>([])
  const [matcherSelections, setMatcherSelections] = useState<Record<string, string>>({})
  const [matcherSelectionProvenance, setMatcherSelectionProvenance] = useState<
    Record<string, MatcherSelectionProvenance>
  >({})
  const [matcherLlmProgress, setMatcherLlmProgress] = useState<MatcherLlmProgress | null>(null)
  const [matcherHttpWaiting, setMatcherHttpWaiting] = useState(false)
  const [matcherRunLog, setMatcherRunLog] = useState<string[]>([])
  const [matcherColumnKey, setMatcherColumnKey] = useState<string | null>(null)

  const handleContactsFileAccepted = useCallback(async (file: File) => {
    setParseError(null)
    setSelectedCompany(null)
    setMatchingCompanyNames([])
    setExcludedMatchNames([])
    setAiSearchError(null)
    setExportError(null)
    setReasoningSteps(null)
    setPersistedAiResultRows(null)
    setOverrideCompanyName(null)
    setCompanyNameOverrideInput('')
    setMatcherRows([])
    setMatcherSelections({})
    setMatcherSelectionProvenance({})
    setMatcherLlmProgress(null)
    setMatcherHttpWaiting(false)
    setMatcherRunLog([])
    setMatcherError(null)
    setMatcherColumnKey(null)
    try {
      const { data, headers: h, companyColumnKey: key, entityColumnKey: entityKey } = await parseContactFile(file)
      setContacts(data)
      setHeaders(h)
      setCompanyColumnKey(key)
      setEntityColumnKey(entityKey)
      setFileName(file.name)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Failed to parse file')
      setContacts([])
      setHeaders([])
      setCompanyColumnKey(null)
      setEntityColumnKey(null)
      setFileName(null)
    }
  }, [])

  const handleCompanyFileAccepted = useCallback(async (file: File) => {
    setCompanyParseError(null)
    setMatcherRows([])
    setMatcherSelections({})
    setMatcherSelectionProvenance({})
    setMatcherLlmProgress(null)
    setMatcherHttpWaiting(false)
    setMatcherRunLog([])
    setMatcherError(null)
    setMatcherColumnKey(null)
    try {
      const { data, headers: h } = await parseCompanyFile(file)
      setCompanies(data)
      setCompanyHeaders(h)
      setCompanyFileName(file.name)
    } catch (e) {
      setCompanyParseError(e instanceof Error ? e.message : 'Failed to parse file')
    }
  }, [])

  const uniqueCompanyNames = useMemo(() => {
    if (!companyColumnKey || !contacts.length) return []
    const set = new Set<string>()
    for (const row of contacts) {
      const v = row[companyColumnKey]
      if (v != null && String(v).trim() !== '') set.add(String(v).trim())
    }
    return Array.from(set)
  }, [contacts, companyColumnKey])

  const matcherContactCounts = useMemo(() => {
    const m = new Map<string, number>()
    if (!companyColumnKey) return m
    for (const row of contacts) {
      const v = String(row[companyColumnKey] ?? '').trim()
      if (!v) continue
      m.set(v, (m.get(v) ?? 0) + 1)
    }
    return m
  }, [contacts, companyColumnKey])

  const matcherCanRun = Boolean(contacts.length > 0 && companies.length > 0 && companyColumnKey)

  const matcherCanonicalNames = useMemo(() => canonicalNamesFromCompanies(companies), [companies])

  /** Match every unique contact company string via LLM against the companies file Name list (closed list on server). */
  const handleRunMatcher = useCallback(async () => {
    if (!companyColumnKey || !contacts.length || !companies.length) return
    setMatcherError(null)
    setMatcherRunning(true)
    setMatcherRows([])
    setMatcherSelectionProvenance({})
    setMatcherLlmProgress(null)
    setMatcherHttpWaiting(false)
    setMatcherRunLog([])
    try {
      const canon = canonicalNamesFromCompanies(companies)
      const raws = uniqueCompanyNames
      const llmItems = raws.map((raw) => ({ raw, topCandidates: [] as string[] }))

      const pushMatcherLog = (line: string) => {
        const ts = new Date().toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
        setMatcherRunLog((prev) => [...prev.slice(-199), `[${ts}] ${line}`])
      }

      const llmByRaw = new Map<string, { match: string | null; alternates?: string[] }>()
      let matcherRunUsageTotals: MatchCompaniesUsageTotals | null = null
      let matcherPricingModel: string | null = null
      if (llmItems.length > 0) {
        const totalBatches = Math.ceil(llmItems.length / MATCH_MATCHER_CLIENT_BATCH_SIZE)
        pushMatcherLog(
          `Starting model pass: ${llmItems.length} unique import string(s), ${canon.length} canonical name(s).`,
        )
        pushMatcherLog(
          `${totalBatches} HTTP batch(es) (max ${MATCH_MATCHER_CLIENT_BATCH_SIZE} strings each); each batch may run several model calls on the server.`,
        )
        setMatcherLlmProgress({ completed: 0, total: totalBatches })
        const { results: llmResults, usageTotals, matcherModel } = await postMatchCompaniesBatched(
          canon,
          llmItems,
          {
            clientBatchSize: MATCH_MATCHER_CLIENT_BATCH_SIZE,
            onHttpRequestStart: ({ batchIndex, batchTotal, itemCount }) => {
              setMatcherHttpWaiting(true)
              pushMatcherLog(`Batch ${batchIndex}/${batchTotal}: sending ${itemCount} string(s)…`)
            },
            onHttpRequestComplete: ({
              batchIndex,
              batchTotal,
              itemCount,
              serverLlmSubBatches,
              modelThisRequest,
              usageThisRequest,
            }) => {
              setMatcherHttpWaiting(false)
              const sub =
                serverLlmSubBatches != null
                  ? ` Server ran ${serverLlmSubBatches} model sub-batch(es) for this request.`
                  : ''
              const modelId = modelThisRequest?.trim() || MATCH_COMPANIES_OPENAI_MODEL
              let tok = ''
              if (usageThisRequest != null && usageThisRequest.totalTokens > 0) {
                const est = estimateOpenAiChatCostUsd(
                  modelId,
                  usageThisRequest.promptTokens,
                  usageThisRequest.completionTokens,
                )
                const estPart =
                  est != null
                    ? ` Est. ${formatUsdEstimate(est)} (${modelId}; OpenAI standard list prices, approximate).`
                    : ` Cannot estimate USD (no rate table for ${modelId}).`
                tok = ` Tokens this request: ${usageThisRequest.totalTokens.toLocaleString()} (in ${usageThisRequest.promptTokens.toLocaleString()} / out ${usageThisRequest.completionTokens.toLocaleString()}).${estPart}`
              }
              pushMatcherLog(`Batch ${batchIndex}/${batchTotal}: got ${itemCount} result(s).${sub}${tok}`)
            },
            onBatchProgress: (completed, total) => {
              setMatcherLlmProgress({ completed, total })
            },
          },
        )
        matcherRunUsageTotals = usageTotals
        matcherPricingModel = matcherModel
        for (const r of llmResults) {
          llmByRaw.set(r.raw, { match: r.match, alternates: r.alternates })
        }
        pushMatcherLog('Model pass complete.')
      } else {
        pushMatcherLog('No unique company strings — skipping model.')
      }

      const nullRaws: string[] = []
      const provenance: Record<string, MatcherSelectionProvenance> = {}

      for (const raw of raws) {
        const llm = llmByRaw.get(raw)
        const ok = Boolean(llm?.match && canon.includes(llm.match))
        if (!ok) nullRaws.push(raw)
      }

      pushMatcherLog(`Local scoring for ${nullRaws.length} string(s) without a model match…`)
      const detRows = matchDeterministicBatch(nullRaws, canon)
      const detByRaw = new Map(detRows.map((row) => [row.raw, row] as const))

      const rows: MatcherRowModel[] = []
      const initSel: Record<string, string> = {}

      for (const raw of raws) {
        const contactCount = matcherContactCounts.get(raw) ?? 0
        const llm = llmByRaw.get(raw)
        const hints = new Set<string>()
        if (llm?.match) hints.add(llm.match)
        if (llm?.alternates) for (const a of llm.alternates) hints.add(a)

        const llmOk = Boolean(llm?.match && canon.includes(llm.match))
        let suggested: string | null = llmOk ? llm!.match! : null
        let source: MatcherRowModel['source'] = 'llm'
        let selection = llmOk ? llm!.match! : ''

        if (llmOk) {
          provenance[raw] = 'llm'
        } else {
          const det = detByRaw.get(raw)
          if (det?.tier === 'auto' && det.best) {
            suggested = det.best
            selection = det.best
            source = 'deterministic_fallback'
            provenance[raw] = 'deterministic'
            for (const c of det.topCandidates) hints.add(c.name)
          } else {
            for (const c of det?.topCandidates ?? []) hints.add(c.name)
          }
        }

        rows.push({
          raw,
          source,
          contactCount,
          suggested,
          optionHints: [...hints],
        })

        initSel[raw] = selection
      }

      rows.sort((a, b) => a.raw.localeCompare(b.raw))
      setMatcherRows(rows)
      setMatcherSelections(initSel)
      setMatcherSelectionProvenance(provenance)

      let nLlm = 0
      let nDet = 0
      let nOpen = 0
      for (const row of rows) {
        if (row.source === 'llm' && row.suggested) nLlm++
        else if (row.source === 'deterministic_fallback') nDet++
        else if (!row.suggested) nOpen++
      }
      setMatcherRunLog((prev) => {
        const ts = new Date().toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
        const lines = [
          `[${ts}] Finished: ${nLlm} from model, ${nDet} fuzzy auto-fill, ${nOpen} need your pick.`,
        ]
        if (llmItems.length > 0 && matcherRunUsageTotals != null) {
          const modelForEst = matcherPricingModel?.trim() || MATCH_COMPANIES_OPENAI_MODEL
          const runEst = estimateOpenAiChatCostUsd(
            modelForEst,
            matcherRunUsageTotals.promptTokens,
            matcherRunUsageTotals.completionTokens,
          )
          const runEstPart =
            runEst != null
              ? ` Est. ${formatUsdEstimate(runEst)} (${modelForEst}; OpenAI standard list prices, approximate).`
              : ` Cannot estimate USD (no rate table for ${modelForEst}).`
          lines.push(
            `[${ts}] LLM tokens (entire matcher run): ${matcherRunUsageTotals.totalTokens.toLocaleString()} total — ${matcherRunUsageTotals.promptTokens.toLocaleString()} prompt + ${matcherRunUsageTotals.completionTokens.toLocaleString()} completion.${runEstPart}`,
          )
        } else if (llmItems.length > 0) {
          lines.push(
            `[${ts}] LLM token usage was not reported by the server for this run (expect totals after upgrading the API).`,
          )
        }
        return [...prev.slice(-199), ...lines]
      })
    } catch (e) {
      setMatcherError(e instanceof Error ? e.message : 'Matcher failed')
      setMatcherRunLog((prev) => {
        const ts = new Date().toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
        const msg = e instanceof Error ? e.message : 'Matcher failed'
        return [...prev.slice(-199), `[${ts}] Error: ${msg}`]
      })
    } finally {
      setMatcherRunning(false)
      setMatcherLlmProgress(null)
      setMatcherHttpWaiting(false)
    }
  }, [companyColumnKey, companies, uniqueCompanyNames, matcherContactCounts])

  const handleMatcherSelectionChange = useCallback((raw: string, value: string) => {
    setMatcherSelections((prev) => ({ ...prev, [raw]: value }))
    setMatcherSelectionProvenance((prev) => ({ ...prev, [raw]: 'manual' }))
  }, [])

  const handleApplyMatcher = useCallback(() => {
    if (!companyColumnKey || matcherRows.length === 0) return
    const colKey = matcherColumnKey ?? pickMatchedCompanyHeader(headers)
    if (!matcherColumnKey) setMatcherColumnKey(colKey)
    setHeaders((h) => (h.includes(colKey) ? h : [...h, colKey]))
    setContacts((prev) =>
      prev.map((row) => {
        const raw = String(row[companyColumnKey] ?? '').trim()
        const pick = (matcherSelections[raw] ?? '').trim()
        return { ...row, [colKey]: pick }
      })
    )
  }, [companyColumnKey, matcherRows.length, matcherColumnKey, headers, matcherSelections])

  const openMatcherTab = useCallback(() => {
    setActiveTab('matcher')
  }, [])

  const handleMatcherToolbarClick = useCallback(() => {
    openMatcherTab()
    void handleRunMatcher()
  }, [openMatcherTab, handleRunMatcher])

  const aiResultsContacts = useMemo(() => {
    if (!companyColumnKey || matchingCompanyNames.length === 0) return []
    const excludedSet = new Set(excludedMatchNames.map((n) => String(n).trim()).filter(Boolean))
    const includedNames = matchingCompanyNames
      .map((n) => String(n).trim())
      .filter((n) => n && !excludedSet.has(n))
    if (includedNames.length === 0) return []
    const set = new Set(includedNames)
    return contacts.filter((row) => {
      const cell = String((row[companyColumnKey] ?? '')).trim()
      return cell && set.has(cell)
    })
  }, [contacts, companyColumnKey, matchingCompanyNames, excludedMatchNames])

  const displayedAiResultRows = useMemo(() => {
    if (persistedAiResultRows == null) return aiResultsContacts
    if (!companyColumnKey) return []
    const excludedSet = new Set(excludedMatchNames.map((n) => String(n).trim()).filter(Boolean))
    return persistedAiResultRows.filter((row) => {
      const cell = String((row[companyColumnKey] ?? '')).trim()
      return cell && !excludedSet.has(cell)
    })
  }, [persistedAiResultRows, aiResultsContacts, excludedMatchNames, companyColumnKey])

  const { aiResultsHeaders, aiResultsContactsWithDescription } = useMemo(() => {
    const extendedHeaders = [...headers, 'Parent company']
    const withDescription: ContactRow[] = displayedAiResultRows.map((row) => ({
      ...row,
      'Parent company': inferredParentCompany ?? '',
      ...(companyColumnKey != null && overrideCompanyName != null ? { [companyColumnKey]: overrideCompanyName } : {}),
    }))
    return { aiResultsHeaders: extendedHeaders, aiResultsContactsWithDescription: withDescription }
  }, [headers, displayedAiResultRows, inferredParentCompany, overrideCompanyName, companyColumnKey])

  const effectiveCompany = (selectedCompany?.trim() || companyInputValue?.trim() || '') || null

  const handleAiSearch = useCallback(async () => {
    const company = effectiveCompany
    if (!company || !companyColumnKey || aiSearchLoading) return
    setAiSearchError(null)

    setReasoningSteps(null)
    setInferredParentCompany(null)
    setOverrideCompanyName(null)
    setCompanyNameOverrideInput('')
    setProcessLogLines([])
    setAiSearchLoading(true)

    const logLines = [
      'LLM: Connecting...',
      `LLM: Sending company list (${uniqueCompanyNames.length.toLocaleString()} names)...`,
      'LLM: Identifying parent company...',
      'LLM: Looking up subsidiaries and brands...',
      'LLM: Matching subsidiaries and variants to your list...',
      'LLM: Checking misspellings and name variants...',
      'LLM: Validating matches...',
      'LLM: Preparing response...',
      'LLM: Finalizing results...',
    ]
    let step = 0
    processLogIntervalRef.current = setInterval(() => {
      setProcessLogLines((prev) => (step < logLines.length ? [...prev, logLines[step++]] : prev))
      if (step >= logLines.length && processLogIntervalRef.current) {
        clearInterval(processLogIntervalRef.current)
        processLogIntervalRef.current = null
      }
    }, 700)

    try {
      const message = `Find everyone that works at ${company}`
      const res = await postChat([{ role: 'user', content: message }], uniqueCompanyNames)
      if (processLogIntervalRef.current) {
        clearInterval(processLogIntervalRef.current)
        processLogIntervalRef.current = null
      }
      setProcessLogLines((prev) => [...prev, 'LLM: Complete.'])
      setMatchingCompanyNames(res.matchingCompanyNames ?? [])
      setExcludedMatchNames([])
      setInferredParentCompany(res.parentCompany ?? null)
      setReasoningSteps(res.reasoningSteps ?? null)
      const matchedNames = res.matchingCompanyNames ?? []
      const matchedRows = contacts.filter((row) => {
        const cell = companyColumnKey ? String(row[companyColumnKey] ?? '').trim() : ''
        return cell && matchedNames.includes(cell)
      })
      setPersistedAiResultRows(matchedRows)
      setActiveTab('normalizer')
      setTimeout(() => setAiSearchLoading(false), 1200)
    } catch (e) {
      if (processLogIntervalRef.current) {
        clearInterval(processLogIntervalRef.current)
        processLogIntervalRef.current = null
      }
      setProcessLogLines((prev) => [...prev, `LLM: Error — ${e instanceof Error ? e.message : 'Request failed'}`])
      setAiSearchError(e instanceof Error ? e.message : 'Request failed')
      setMatchingCompanyNames([])
      setExcludedMatchNames([])
      setInferredParentCompany(null)
      setReasoningSteps(null)
      setPersistedAiResultRows(null)
      setTimeout(() => setAiSearchLoading(false), 2000)
    }
  }, [effectiveCompany, companyColumnKey, uniqueCompanyNames, aiSearchLoading, contacts])

  const handleExportResults = useCallback(() => {
    setExportError(null)
    try {
      const segment = sanitizeFilenameSegment(selectedCompany ?? 'search')
      const date = new Date().toISOString().slice(0, 10)
      const filename = `ai-results-${segment}-${date}.csv`
      downloadCsv(aiResultsContactsWithDescription, aiResultsHeaders, filename)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed. Please try again.')
    }
  }, [selectedCompany, aiResultsContactsWithDescription, aiResultsHeaders])

  const handleRemoveResultsFromImport = useCallback(() => {
    const toRemove = new Set(displayedAiResultRows)
    setContacts((prev) => prev.filter((row) => !toRemove.has(row)))
    setActiveTab('contacts')
  }, [displayedAiResultRows])

  const handleExportImportList = useCallback(() => {
    const date = new Date().toISOString().slice(0, 10)
    const base = fileName ? sanitizeFilenameSegment(fileName.replace(/\.[^.]+$/, '')) : 'import-list'
    downloadCsv(contacts, headers, `${base}-${date}.csv`)
  }, [contacts, headers, fileName])

  const hasContacts = contacts.length > 0
  const hasCompanies = companies.length > 0

  const openUpload = useCallback((kind: UploadImportKind) => {
    setUploadImportKind(kind)
    if (kind === 'contacts') setParseError(null)
    else setCompanyParseError(null)
    setUploadDialogOpen(true)
  }, [])

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        minHeight: 0,
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <AppBar position="static" elevation={0} sx={{ width: '100%', borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar
          variant="dense"
          disableGutters
          sx={{ width: '100%', maxWidth: '100%', px: { xs: 1.5, sm: 2 }, gap: 1, minHeight: 44, flexWrap: 'nowrap' }}
        >
          <Typography variant="subtitle1" component="div" sx={{ flex: 1, fontWeight: 600, fontSize: '1rem', lineHeight: 1.2 }}>
            List-O-Matic 2000
          </Typography>
          <IconButton color="inherit" size="small" onClick={onToggleMode} aria-label="Toggle theme">
            {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
        </Toolbar>
      </AppBar>

      <UploadDropZone
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        variant={uploadImportKind}
        onFileAccepted={uploadImportKind === 'contacts' ? handleContactsFileAccepted : handleCompanyFileAccepted}
      />

      <Dialog open={aiSearchLoading} disableEscapeKeyDown maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 }, 'data-testid': 'llm-search-dialog' } as object}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={24} color="primary" />
          LLM searching...
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.813rem',
              borderRadius: 1,
              p: 2,
              maxHeight: 320,
              overflow: 'auto',
              position: 'relative',
              bgcolor: 'action.hover',
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: 1,
                background: 'linear-gradient(105deg, transparent 0%, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%, transparent 100%)',
                backgroundSize: '200% 100%',
                animation: `${logShimmer} 2.5s ease-in-out infinite`,
                pointerEvents: 'none',
              },
            }}
          >
            {processLogLines.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ position: 'relative', zIndex: 1 }}>
                LLM: Starting...
              </Typography>
            ) : (
              processLogLines.map((line, i) => (
                <Box key={i} component="div" sx={{ py: 0.25, position: 'relative', zIndex: 1 }}>
                  <Typography component="span" variant="body2" sx={{ fontFamily: 'inherit', fontSize: 'inherit' }}>
                    {line}
                  </Typography>
                </Box>
              ))
            )}
          </Box>
          <Typography
            variant="body2"
            sx={{ mt: 2, color: 'error.main', fontWeight: 500 }}
          >
            LLM results may be incorrect or inaccurate. Please check results.
          </Typography>
        </DialogContent>
      </Dialog>

      <Container
        maxWidth={false}
        component="main"
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          py: 2,
          px: { xs: 2, sm: 3 },
          overflow: 'hidden',
          position: 'relative',
          width: '100%',
          maxWidth: '100%',
        }}
        data-testid="main-content"
      >
        {!hasContacts && !hasCompanies && parseError && (
          <Alert severity="error" onClose={() => setParseError(null)} sx={{ mb: 2 }}>
            {parseError}
          </Alert>
        )}
        {!hasContacts && !hasCompanies && companyParseError && (
          <Alert severity="error" onClose={() => setCompanyParseError(null)} sx={{ mb: 2 }}>
            {companyParseError}
          </Alert>
        )}

        {!hasContacts && !hasCompanies && (
          <Box
            sx={{
              position: 'fixed',
              top: 48,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              px: 2,
              bgcolor: 'background.default',
              zIndex: 0,
            }}
          >
            <Paper
              variant="outlined"
              sx={{
                textAlign: 'center',
                p: 4,
                maxWidth: 520,
                width: '100%',
                borderRadius: 2,
                bgcolor: 'background.paper',
                boxShadow: (theme) => (theme.palette.mode === 'dark' ? undefined : '0 2px 12px rgba(0,0,0,0.06)'),
              }}
            >
              <Typography variant="h6" color="text.primary" gutterBottom sx={{ fontWeight: 600 }}>
                Get started
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Import contacts (standard or legacy CSV/Excel) and optionally a companies file. You can upload either one first.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<UploadFileIcon />}
                  onClick={() => openUpload('contacts')}
                  sx={{ minWidth: 180 }}
                  data-testid="upload-trigger-contacts"
                >
                  Import contacts
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<UploadFileIcon />}
                  onClick={() => openUpload('companies')}
                  sx={{ minWidth: 180 }}
                  data-testid="upload-trigger-companies"
                >
                  Import companies
                </Button>
              </Box>
            </Paper>
          </Box>
        )}

        {hasCompanies && !hasContacts && (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {companyParseError && (
              <Alert severity="error" onClose={() => setCompanyParseError(null)} sx={{ mb: 2, flexShrink: 0 }}>
                {companyParseError}
              </Alert>
            )}
            {parseError && (
              <Alert severity="error" onClose={() => setParseError(null)} sx={{ mb: 2, flexShrink: 0 }}>
                {parseError}
              </Alert>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, flexShrink: 0 }}>
              {companyFileName} — {companies.length.toLocaleString()} company row{companies.length !== 1 ? 's' : ''}
            </Typography>
            <Typography variant="body1" color="text.primary" sx={{ mb: 2, flexShrink: 0 }}>
              Upload a contacts file to use Contact Company Normalizer and the full workspace.
            </Typography>
            <Box sx={{ mb: 2, flexShrink: 0 }}>
              <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => openUpload('contacts')} data-testid="upload-contacts-from-companies-only">
                Import contacts
              </Button>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <AgCompaniesGrid companies={companies} headers={companyHeaders} fillContainer />
            </Box>
          </Box>
        )}

        {hasContacts && (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {parseError && (
              <Alert severity="error" onClose={() => setParseError(null)} sx={{ mb: 2, flexShrink: 0 }}>
                {parseError}
              </Alert>
            )}
            {companyParseError && (
              <Alert severity="error" onClose={() => setCompanyParseError(null)} sx={{ mb: 2, flexShrink: 0 }}>
                {companyParseError}
              </Alert>
            )}
            <Paper variant="outlined" sx={{ p: 1, mb: 2, borderRadius: 2, bgcolor: 'background.default', flexShrink: 0 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  flexWrap: 'nowrap',
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  minHeight: 40,
                  // Allow horizontal scroll on narrow viewports instead of wrapping to a second row.
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ flexShrink: 0, lineHeight: 1.3, whiteSpace: 'nowrap' }}
                  title={
                    [
                      `${fileName} — ${contacts.length.toLocaleString()} rows`,
                      companyColumnKey ? `Company column: "${companyColumnKey}"` : 'No company column',
                      hasCompanies && companyFileName
                        ? `Companies: ${companyFileName} — ${companies.length.toLocaleString()} rows`
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  }
                >
                  {fileName} — {contacts.length.toLocaleString()} rows
                  {companyColumnKey ? ` · "${companyColumnKey}"` : ' · No company column'}
                  {hasCompanies && companyFileName
                    ? ` · Companies: ${companyFileName} (${companies.length.toLocaleString()})`
                    : ''}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<UploadFileIcon sx={{ fontSize: 18 }} />}
                  onClick={() => openUpload('companies')}
                  data-testid="import-companies-toolbar"
                  sx={{ flexShrink: 0, fontSize: '0.75rem', py: 0.5, px: 1, whiteSpace: 'nowrap' }}
                >
                  {hasCompanies ? 'Replace companies' : 'Import companies'}
                </Button>
                <CompanySelect
                  contacts={contacts}
                  companyColumnKey={companyColumnKey}
                  value={selectedCompany}
                  onChange={setSelectedCompany}
                  onInputValueChange={setCompanyInputValue}
                  disabled={!companyColumnKey}
                />
                <Tooltip title="Contact Company Normalizer">
                  <span>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={
                        aiSearchLoading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon sx={{ fontSize: 18 }} />
                      }
                      onClick={handleAiSearch}
                      disabled={!effectiveCompany || !companyColumnKey || aiSearchLoading}
                      data-testid="contact-company-normalizer-button"
                      sx={{ flexShrink: 0, fontSize: '0.75rem', py: 0.5, px: 1, whiteSpace: 'nowrap' }}
                    >
                      Normalizer
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip
                  title={
                    matcherCanRun
                      ? 'Contact Company Matcher: run matching against your companies list.'
                      : 'Import a companies file and ensure contacts include a company column.'
                  }
                >
                  <span>
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={!matcherCanRun || matcherRunning}
                      onClick={handleMatcherToolbarClick}
                      data-testid="contact-company-matcher-button"
                      sx={{ flexShrink: 0, fontSize: '0.75rem', py: 0.5, px: 1, whiteSpace: 'nowrap' }}
                    >
                      Matcher
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            </Paper>

            {aiSearchError && (
              <Alert severity="error" onClose={() => setAiSearchError(null)} sx={{ mb: 2, flexShrink: 0 }}>
                {aiSearchError}
              </Alert>
            )}

            <Tabs
              value={activeTab}
              onChange={(_, v: TabValue) => setActiveTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{
                mb: 0,
                minHeight: 40,
                flexShrink: 0,
                borderBottom: 1,
                borderColor: 'divider',
                '& .MuiTab-root': { minHeight: 40, py: 0.5, fontSize: '0.8rem', textTransform: 'none' },
              }}
              textColor="primary"
              indicatorColor="primary"
              data-testid="tabs-main"
            >
              <Tab label="Contacts" value="contacts" data-testid="tab-contacts" />
              <Tab label="Companies" value="companies" data-testid="tab-companies" />
              <Tab
                label="Contact Company Normalizer"
                value="normalizer"
                data-testid="tab-results-normalizer"
              />
              <Tab
                label="Contact Company Matcher"
                value="matcher"
                data-testid="tab-results-matcher"
              />
            </Tabs>

            <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', pt: 2 }}>
            {activeTab === 'contacts' && (
              <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, flexShrink: 0 }}>
                  <Typography variant="subtitle2" color="primary">
                    Import list — {contacts.length.toLocaleString()} row{contacts.length !== 1 ? 's' : ''}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={handleExportImportList}
                    data-testid="export-import-list-button"
                  >
                    Export list
                  </Button>
                </Box>
                <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <AgContactsGrid
                    contacts={contacts}
                    headers={headers}
                    fillContainer
                    companyColumnKey={companyColumnKey}
                    entityColumnKey={entityColumnKey}
                  />
                </Box>
              </Box>
            )}

            {activeTab === 'companies' && (
              <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {!hasCompanies ? (
                  <Box sx={{ py: 2, flexShrink: 0 }}>
                    <Typography color="text.secondary" sx={{ mb: 2 }}>
                      No companies file loaded yet.
                    </Typography>
                    <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => openUpload('companies')}>
                      Import companies
                    </Button>
                  </Box>
                ) : (
                  <>
                    <Typography variant="subtitle2" color="primary" sx={{ mb: 1, flexShrink: 0 }}>
                      {companyFileName} — {companies.length.toLocaleString()} row{companies.length !== 1 ? 's' : ''}
                    </Typography>
                    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                      <AgCompaniesGrid companies={companies} headers={companyHeaders} fillContainer />
                    </Box>
                  </>
                )}
              </Box>
            )}

            {activeTab === 'normalizer' && (
              <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {matchingCompanyNames.length === 0 ? (
                  <Box sx={{ py: 4, flexShrink: 0 }}>
                    <Typography color="text.secondary">
                      Select a company and run Contact Company Normalizer to see matching contacts here.
                    </Typography>
                  </Box>
                ) : (
                  <Box
                        sx={{
                          flex: 1,
                          minHeight: 0,
                          display: 'flex',
                          flexDirection: { xs: 'column', lg: 'row' },
                          gap: 2,
                          alignItems: 'stretch',
                        }}
                      >
                        <Box
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            minHeight: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            order: { xs: 1, lg: 1 },
                          }}
                        >
                          <Typography variant="subtitle2" color="primary" sx={{ flexShrink: 0, mb: 1 }}>
                            Results — {displayedAiResultRows.length.toLocaleString()} contact
                            {displayedAiResultRows.length !== 1 ? 's' : ''}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1, flexShrink: 0 }}>
                            <Typography variant="caption" color="text.secondary">
                              {aiResultsContactsWithDescription.length.toLocaleString()} row
                              {aiResultsContactsWithDescription.length !== 1 ? 's' : ''} in table
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              <Button
                                variant="contained"
                                size="small"
                                startIcon={<DownloadIcon />}
                                onClick={handleExportResults}
                                data-testid="export-results-button"
                              >
                                Export results
                              </Button>
                              <CrmExportFeature
                                contacts={aiResultsContactsWithDescription}
                                headers={aiResultsHeaders}
                              />
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={handleRemoveResultsFromImport}
                                data-testid="remove-from-import-button"
                              >
                                Remove records from Import List
                              </Button>
                            </Box>
                          </Box>
                          {exportError && (
                            <Alert severity="error" onClose={() => setExportError(null)} sx={{ mb: 1, flexShrink: 0 }}>
                              {exportError}
                            </Alert>
                          )}
                          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                            <AgContactsGrid
                              contacts={aiResultsContactsWithDescription}
                              headers={aiResultsHeaders}
                              fillContainer
                              companyColumnKey={companyColumnKey}
                              entityColumnKey={entityColumnKey}
                            />
                          </Box>
                        </Box>

                        <Paper
                          variant="outlined"
                          sx={{
                            flex: { lg: '0 0 380px' },
                            width: { xs: '100%', lg: 380 },
                            minHeight: 0,
                            maxHeight: { xs: '42vh', lg: 'none' },
                            overflow: 'auto',
                            p: 1.5,
                            borderRadius: 2,
                            alignSelf: { xs: 'stretch', lg: 'stretch' },
                            order: { xs: 2, lg: 2 },
                          }}
                        >
                          <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                            Search details
                          </Typography>
                          {reasoningSteps != null && reasoningSteps.length > 0 && (
                            <Accordion
                              defaultExpanded={false}
                              sx={{ mb: 1, borderRadius: 1, '&:before': { display: 'none' }, border: 1, borderColor: 'divider' }}
                            >
                              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="subtitle2" color="primary">
                                  How the agent matched
                                </Typography>
                              </AccordionSummary>
                              <AccordionDetails sx={{ pt: 0 }}>
                                <List dense disablePadding>
                                  {reasoningSteps.map((step, i) => (
                                    <ListItem key={i} sx={{ py: 0.25, display: 'block' }}>
                                      <Typography variant="body2" fontWeight={600} component="span">
                                        {step.title}
                                      </Typography>
                                      {step.detail && (
                                        <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 0.5 }}>
                                          — {step.detail}
                                        </Typography>
                                      )}
                                    </ListItem>
                                  ))}
                                </List>
                              </AccordionDetails>
                            </Accordion>
                          )}
                          <Accordion
                            defaultExpanded
                            sx={{ mb: 1, borderRadius: 1, '&:before': { display: 'none' }, border: 1, borderColor: 'divider' }}
                          >
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                              <Typography variant="subtitle2" color="primary">
                                Import strings matched to parent
                              </Typography>
                            </AccordionSummary>
                            <AccordionDetails sx={{ pt: 0 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                {matchingCompanyNames.length} value{matchingCompanyNames.length !== 1 ? 's' : ''} from your
                                file the LLM tied to this parent (not necessarily legal names). Toggle to include or
                                exclude from the results set.
                              </Typography>
                              <List dense sx={{ maxHeight: { xs: 160, sm: 220 }, overflowY: 'auto' }}>
                                {(() => {
                                  const excludedSet = new Set(excludedMatchNames)
                                  return [...matchingCompanyNames].sort((a, b) => a.localeCompare(b)).map((name) => {
                                    const included = !excludedSet.has(name)
                                    return (
                                      <ListItem key={name} sx={{ py: 0 }} disablePadding>
                                        <Checkbox
                                          size="small"
                                          checked={included}
                                          onChange={() => {
                                            setExcludedMatchNames((prev) =>
                                              prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
                                            )
                                          }}
                                          sx={{ py: 0, mr: 1 }}
                                        />
                                        <ListItemText primary={name} primaryTypographyProps={{ variant: 'body2' }} />
                                      </ListItem>
                                    )
                                  })
                                })()}
                              </List>
                            </AccordionDetails>
                          </Accordion>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
                            <TextField
                              size="small"
                              label="Override company column"
                              placeholder="e.g. Apple Inc."
                              value={companyNameOverrideInput}
                              onChange={(e) => setCompanyNameOverrideInput(e.target.value)}
                              sx={{ minWidth: 200, flex: 1 }}
                            />
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => {
                                const v = companyNameOverrideInput.trim()
                                setOverrideCompanyName(v || null)
                              }}
                            >
                              Apply
                            </Button>
                          </Box>
                        </Paper>
                      </Box>
                )}
              </Box>
            )}

            {activeTab === 'matcher' && (
              <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <MatcherReviewPanel
                  canRun={matcherCanRun}
                  running={matcherRunning}
                  error={matcherError}
                  onDismissError={() => setMatcherError(null)}
                  contacts={contacts}
                  headers={headers}
                  companyColumnKey={companyColumnKey}
                  rows={matcherRows}
                  canonicalNames={matcherCanonicalNames}
                  selection={matcherSelections}
                  selectionProvenance={matcherSelectionProvenance}
                  llmProgress={matcherLlmProgress}
                  httpWaiting={matcherHttpWaiting}
                  runLog={matcherRunLog}
                  onSelectionChange={handleMatcherSelectionChange}
                  onRun={handleRunMatcher}
                  onApply={handleApplyMatcher}
                />
              </Box>
            )}
            </Box>
          </Box>
        )}
      </Container>
    </Box>
  )
}

export default function App() {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('themeMode') as 'light' | 'dark' | null
    return stored ?? 'light'
  })
  const theme = useMemo(() => getAppTheme(mode), [mode])
  const onToggleMode = useCallback(() => {
    const next = mode === 'light' ? 'dark' : 'light'
    setMode(next)
    localStorage.setItem('themeMode', next)
  }, [mode])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ width: '100%', height: '100vh', overflow: 'hidden' }}>
        <AppContent mode={mode} onToggleMode={onToggleMode} />
      </Box>
    </ThemeProvider>
  )
}
