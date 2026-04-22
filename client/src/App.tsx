/**
 * @file App.tsx
 * @description Main application: tabs (Contacts, Companies, Normalizer, Matcher), upload, company select, and results tools.
 * @module List-O-Matic-2000/client
 */
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
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
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import MenuIcon from '@mui/icons-material/Menu'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import SearchIcon from '@mui/icons-material/Search'
import DownloadIcon from '@mui/icons-material/Download'
import { coerceTrimmed, isNonEmptyCoercedTrimmed } from '@vendor-shared/lib/strings'
import { getAppTheme } from './theme'
import { parseContactFile, parseCompanyFile, type ContactRow, type CompanyRow } from './utils/parseFile'
import { downloadCsv, sanitizeFilenameSegment } from './utils/exportCsv'
import { ImportWorkflowDialog, type UploadImportKind } from './components/UploadDropZone'
import { AgContactsGrid } from './components/AgContactsGrid'
import { AgCompaniesGrid } from './components/AgCompaniesGrid'
import { ParentKeyGrid, type ParentKeyRow } from './components/ParentKeyGrid'
import { MatchKeyGrid } from './components/MatchKeyGrid'
import { CompanySelect } from './components/CompanySelect'
import { postChat } from './api/chat'
import {
  postMatchCompaniesBatched,
  type MatchCompaniesUsageTotals,
  type MatcherServerStreamProgress,
} from './api/matchCompanies'
import { CrmExportFeature } from './components/CrmExportFeature'
import {
  MatcherReviewPanel,
  type MatcherRowModel,
  type MatcherLlmProgress,
  type MatcherSelectionProvenance,
} from './components/MatcherReviewPanel'
import {
  MATCH_MATCHER_CLIENT_BATCH_SIZE,
  MATCH_MATCHER_CONCURRENT_HTTP,
} from './constants/companyMatch'
import {
  estimateOpenAiChatCostUsd,
  formatUsdEstimate,
  MATCH_COMPANIES_OPENAI_MODEL,
} from './constants/openaiPricing'
import { canonicalNamesFromCompanies } from './utils/companyMatch'
import { buildMatchKeyGridRows } from './utils/matcherContactMatchGrid'
import {
  getMatcherKeybook,
  type MatcherKeybookContactMatchRow,
  type MatcherKeybookSnapshot,
} from './api/matcherKeybook'
import { computeMatcherKeybookCoverage } from './utils/matcherKeybookCoverage'

function applyMatcherStreamProgress(
  prev: MatcherLlmProgress | null,
  ev: MatcherServerStreamProgress,
  fallbackBatchTotal: number
): MatcherLlmProgress {
  const base: MatcherLlmProgress = prev ?? { completed: 0, total: fallbackBatchTotal }
  const server = { ...base.server }
  if (ev.phase === 'step1') {
    server.step1 = {
      completed: ev.completed ?? 0,
      total: ev.total ?? 1,
      cached: ev.cached,
    }
  }
  if (ev.phase === 'step2') {
    server.step2 = { completed: ev.completed ?? 0, total: ev.total ?? 1 }
  }
  if (ev.phase === 'step3') {
    server.step3 = { done: true, detail: ev.detail }
  }
  if (ev.phase === 'fallback') {
    server.fallback = { completed: ev.completed ?? 0, total: ev.total ?? 1 }
  }
  return { completed: base.completed, total: base.total, server }
}

type TabValue =
  | 'contacts'
  | 'companies'
  | 'normalizer'
  | 'matcher'
  | 'companyKey'
  | 'contactCompanyKey'
  | 'contactCompanyMatch'

type WorkspaceMode = 'normalizer' | 'matcher'

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
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode | null>(null)
  const [uploadMenuAnchor, setUploadMenuAnchor] = useState<null | HTMLElement>(null)
  const uploadMenuOpen = Boolean(uploadMenuAnchor)
  const [aiSearchLoading, setAiSearchLoading] = useState(false)
  const [aiSearchError, setAiSearchError] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [persistedAiResultRows, setPersistedAiResultRows] = useState<ContactRow[] | null>(null)
  const [processLogLines, setProcessLogLines] = useState<string[]>([])
  const [normalizerLogVisible, setNormalizerLogVisible] = useState(true)
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
  const [matcherParentByCanon, setMatcherParentByCanon] = useState<Record<string, string>>({})
  const [matcherParentByRaw, setMatcherParentByRaw] = useState<Record<string, string>>({})
  const [matcherContactMatchRows, setMatcherContactMatchRows] = useState<MatcherKeybookContactMatchRow[]>([])
  const [matcherKeybookSnapshot, setMatcherKeybookSnapshot] = useState<MatcherKeybookSnapshot | null>(null)
  const [contactCompanyMatchMatchedOnly, setContactCompanyMatchMatchedOnly] = useState(false)
  /** In-flight POST /api/match-companies count (matcher uses parallel batches when >1). */
  const matcherHttpInFlightRef = useRef(0)

  const handleContactsFileAccepted = useCallback(async (file: File) => {
    setParseError(null)
    setSelectedCompany(null)
    setMatchingCompanyNames([])
    setExcludedMatchNames([])
    setAiSearchError(null)
    setExportError(null)
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
    setMatcherParentByCanon({})
    setMatcherParentByRaw({})
    setMatcherContactMatchRows([])
    try {
      const { data, headers: h, companyColumnKey: key, entityColumnKey: entityKey } = await parseContactFile(file)
      setContacts(data)
      setHeaders(h)
      setCompanyColumnKey(key)
      setEntityColumnKey(entityKey)
      setFileName(file.name)
      setWorkspaceMode(null)
      return { fileName: file.name, rowCount: data.length }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to parse file'
      setParseError(msg)
      setContacts([])
      setHeaders([])
      setCompanyColumnKey(null)
      setEntityColumnKey(null)
      setFileName(null)
      throw e
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
    setMatcherParentByCanon({})
    setMatcherParentByRaw({})
    setMatcherContactMatchRows([])
    try {
      const { data, headers: h } = await parseCompanyFile(file)
      setCompanies(data)
      setCompanyHeaders(h)
      setCompanyFileName(file.name)
      return { fileName: file.name, rowCount: data.length }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to parse file'
      setCompanyParseError(msg)
      throw e
    }
  }, [])

  const uniqueCompanyNames = useMemo(() => {
    if (!companyColumnKey || !contacts.length) return []
    const set = new Set<string>()
    for (const row of contacts) {
      const v = row[companyColumnKey]
      if (isNonEmptyCoercedTrimmed(v)) set.add(coerceTrimmed(v))
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

  const companyKeyRows = useMemo<ParentKeyRow[]>(
    () =>
      matcherCanonicalNames
        .slice()
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({
          name,
          parentCompany: (matcherParentByCanon[name] ?? '').trim(),
        })),
    [matcherCanonicalNames, matcherParentByCanon],
  )

  const contactCompanyKeyRows = useMemo<ParentKeyRow[]>(() => {
    if (!companyColumnKey) return []
    const sorted = [...uniqueCompanyNames].sort((a, b) => a.localeCompare(b))
    return sorted.map((raw) => {
      const fromRaw = (matcherParentByRaw[raw] ?? '').trim()
      const sel = (matcherSelections[raw] ?? '').trim()
      const fromCanon = sel ? (matcherParentByCanon[sel] ?? '').trim() : ''
      return { name: raw, parentCompany: fromRaw || fromCanon }
    })
  }, [uniqueCompanyNames, companyColumnKey, matcherParentByRaw, matcherParentByCanon, matcherSelections])

  const contactCompanyMatchGridRows = useMemo(
    () => buildMatchKeyGridRows(matcherContactMatchRows, companies),
    [matcherContactMatchRows, companies],
  )

  const matcherKeybookCoverage = useMemo(
    () => computeMatcherKeybookCoverage(matcherKeybookSnapshot, matcherCanonicalNames, uniqueCompanyNames),
    [matcherKeybookSnapshot, matcherCanonicalNames, uniqueCompanyNames],
  )

  useEffect(() => {
    if (activeTab !== 'contactCompanyMatch') {
      setContactCompanyMatchMatchedOnly(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const snap = await getMatcherKeybook()
        if (!cancelled) {
          setMatcherContactMatchRows(snap.contactCompanyMatch)
          if (workspaceMode === 'matcher') setMatcherKeybookSnapshot(snap)
        }
      } catch {
        if (!cancelled) setMatcherContactMatchRows([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeTab, workspaceMode])

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
    setMatcherParentByCanon({})
    setMatcherParentByRaw({})
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
        if (MATCH_MATCHER_CONCURRENT_HTTP > 1) {
          pushMatcherLog(
            `Up to ${MATCH_MATCHER_CONCURRENT_HTTP} batches in parallel; per-step NDJSON progress is off during parallel runs.`,
          )
        }
        setMatcherLlmProgress({ completed: 0, total: totalBatches })
        matcherHttpInFlightRef.current = 0
        const { results: llmResults, usageTotals, matcherModel, parentByCanon, parentByRaw } =
          await postMatchCompaniesBatched(
          canon,
          llmItems,
          {
            clientBatchSize: MATCH_MATCHER_CLIENT_BATCH_SIZE,
            concurrency: MATCH_MATCHER_CONCURRENT_HTTP,
            onHttpRequestStart: ({ batchIndex, batchTotal, itemCount }) => {
              matcherHttpInFlightRef.current += 1
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
              matcherHttpInFlightRef.current = Math.max(0, matcherHttpInFlightRef.current - 1)
              if (matcherHttpInFlightRef.current === 0) {
                setMatcherHttpWaiting(false)
              }
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
            onServerStreamProgress: (ev) => {
              setMatcherLlmProgress((prev) => applyMatcherStreamProgress(prev, ev, totalBatches))
            },
          },
        )
        matcherRunUsageTotals = usageTotals
        matcherPricingModel = matcherModel
        setMatcherParentByCanon(parentByCanon)
        setMatcherParentByRaw(parentByRaw)
        for (const r of llmResults) {
          llmByRaw.set(r.raw, { match: r.match, alternates: r.alternates })
        }
        pushMatcherLog('Model pass complete.')
      } else {
        pushMatcherLog('No unique company strings — skipping model.')
      }

      const provenance: Record<string, MatcherSelectionProvenance> = {}

      const rows: MatcherRowModel[] = []
      const initSel: Record<string, string> = {}

      for (const raw of raws) {
        const contactCount = matcherContactCounts.get(raw) ?? 0
        const llm = llmByRaw.get(raw)
        const hints = new Set<string>()
        if (llm?.match) hints.add(llm.match)
        if (llm?.alternates) for (const a of llm.alternates) hints.add(a)

        const llmOk = Boolean(llm?.match && canon.includes(llm.match))
        const suggested: string | null = llmOk ? llm!.match! : null
        const source: MatcherRowModel['source'] = llmOk ? 'llm' : 'ambiguous'

        if (llmOk) {
          provenance[raw] = 'llm'
          initSel[raw] = llm!.match!
        }

        rows.push({
          raw,
          source,
          contactCount,
          suggested,
          optionHints: [...hints],
        })
      }

      rows.sort((a, b) => a.raw.localeCompare(b.raw))
      setMatcherRows(rows)
      setMatcherSelections(initSel)
      setMatcherSelectionProvenance(provenance)

      let nLlm = 0
      let nOpen = 0
      for (const row of rows) {
        if (row.source === 'llm' && row.suggested) nLlm++
        else if (!row.suggested) nOpen++
      }
      setMatcherRunLog((prev) => {
        const ts = new Date().toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
        const lines = [
          `[${ts}] Finished: ${nLlm} from model, ${nOpen} need your pick.`,
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
      try {
        const snap = await getMatcherKeybook()
        setMatcherContactMatchRows(snap.contactCompanyMatch)
        setMatcherKeybookSnapshot(snap)
      } catch {
        /* keybook GET is optional; matcher already persisted server-side */
      }
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
      matcherHttpInFlightRef.current = 0
      setMatcherRunning(false)
      setMatcherLlmProgress(null)
      setMatcherHttpWaiting(false)
    }
  }, [companyColumnKey, companies, uniqueCompanyNames, matcherContactCounts])

  const handleMatcherSelectionChange = useCallback((raw: string, value: string) => {
    setMatcherSelections((prev) => ({ ...prev, [raw]: value }))
    setMatcherSelectionProvenance((prev) => ({ ...prev, [raw]: 'manual' }))
  }, [])

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

    setInferredParentCompany(null)
    setOverrideCompanyName(null)
    setCompanyNameOverrideInput('')
    setProcessLogLines([])
    setAiSearchLoading(true)
    if (workspaceMode === 'normalizer') {
      setActiveTab('normalizer')
    }

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
      const matchedNames = res.matchingCompanyNames ?? []
      const matchedRows = contacts.filter((row) => {
        const cell = companyColumnKey ? String(row[companyColumnKey] ?? '').trim() : ''
        return cell && matchedNames.includes(cell)
      })
      setPersistedAiResultRows(matchedRows)
      if (workspaceMode === 'normalizer') setActiveTab('normalizer')
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
      setPersistedAiResultRows(null)
      setTimeout(() => setAiSearchLoading(false), 2000)
    }
  }, [effectiveCompany, companyColumnKey, uniqueCompanyNames, aiSearchLoading, contacts, workspaceMode])

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

  useEffect(() => {
    if (workspaceMode !== 'matcher' || !hasContacts) {
      setMatcherKeybookSnapshot(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const snap = await getMatcherKeybook()
        if (!cancelled) setMatcherKeybookSnapshot(snap)
      } catch {
        if (!cancelled) setMatcherKeybookSnapshot(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [workspaceMode, hasContacts, matcherCanonicalNames.length, uniqueCompanyNames.length])
  const showNormalizerActivity = aiSearchLoading || processLogLines.length > 0

  useEffect(() => {
    if (aiSearchLoading) setNormalizerLogVisible(true)
  }, [aiSearchLoading])

  useEffect(() => {
    if (!hasContacts) {
      setWorkspaceMode(null)
      setActiveTab('contacts')
    }
  }, [hasContacts])

  useEffect(() => {
    if (workspaceMode === 'normalizer' && activeTab === 'matcher') setActiveTab('contacts')
    else if (workspaceMode === 'matcher' && activeTab === 'normalizer') setActiveTab('contacts')
  }, [workspaceMode, activeTab])

  const openUpload = useCallback((kind: UploadImportKind) => {
    setUploadImportKind(kind)
    if (kind === 'contacts') setParseError(null)
    else setCompanyParseError(null)
    setUploadDialogOpen(true)
  }, [])

  const matcherStartToolbarButton =
    workspaceMode === 'matcher' ? (
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
          >
            Start Matcher
          </Button>
        </span>
      </Tooltip>
    ) : null

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
      <AppBar
        position="static"
        elevation={0}
        sx={(theme) => ({
          width: '100%',
          flexShrink: 0,
          position: 'relative',
          zIndex: theme.zIndex.appBar,
          overflow: 'visible',
        })}
      >
        <Toolbar
          disableGutters
          sx={{
            width: '100%',
            maxWidth: '100%',
            px: { xs: 1.5, sm: 2 },
            py: 0,
            gap: 1.5,
            minHeight: 90,
            boxSizing: 'border-box',
            flexWrap: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              flex: 1,
              minWidth: 0,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                lineHeight: 0,
                flexShrink: 0,
              }}
            >
              <Box
                component="img"
                src="/logoLight.png"
                alt=""
                sx={{ height: 72, width: 'auto', display: 'block', objectFit: 'contain' }}
              />
            </Box>
            <Typography
              variant="subtitle1"
              component="div"
              sx={{
                fontWeight: 600,
                fontSize: '1rem',
                lineHeight: 1.25,
                color: 'inherit',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              List-O-Matic 2000
            </Typography>
            {activeTab === 'contactCompanyMatch' && (
              <Tooltip
                title={
                  contactCompanyMatchMatchedOnly
                    ? 'Show every row from the persisted snapshot.'
                    : 'Hide rows where Matched company is empty; keep the quick filter for text search.'
                }
              >
                <Button
                  variant={contactCompanyMatchMatchedOnly ? 'contained' : 'outlined'}
                  size="small"
                  color="inherit"
                  onClick={() => setContactCompanyMatchMatchedOnly((v) => !v)}
                  sx={{
                    ml: { xs: 1, sm: 2 },
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    ...(!contactCompanyMatchMatchedOnly
                      ? { borderColor: 'rgba(255,255,255,0.45)' }
                      : {
                          bgcolor: 'primary.contrastText',
                          color: 'primary.main',
                          '&:hover': { bgcolor: 'primary.contrastText', opacity: 0.92 },
                        }),
                  }}
                  data-testid="header-contact-company-match-matched-only"
                >
                  {contactCompanyMatchMatchedOnly ? 'Show all rows' : 'Matched rows only'}
                </Button>
              </Tooltip>
            )}
          </Box>
          <IconButton
            color="inherit"
            size="small"
            onClick={(e) => setUploadMenuAnchor(e.currentTarget)}
            aria-label="App menu"
            aria-controls={uploadMenuOpen ? 'header-upload-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={uploadMenuOpen ? 'true' : undefined}
            data-testid="header-upload-menu-button"
          >
            <MenuIcon fontSize="small" />
          </IconButton>
          <Menu
            id="header-upload-menu"
            anchorEl={uploadMenuAnchor}
            open={uploadMenuOpen}
            onClose={() => setUploadMenuAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ list: { dense: true } }}
          >
            <MenuItem
              onClick={() => {
                setUploadMenuAnchor(null)
                openUpload('contacts')
              }}
              data-testid="header-upload-contacts"
            >
              Upload contacts
            </MenuItem>
            <MenuItem
              onClick={() => {
                setUploadMenuAnchor(null)
                openUpload('companies')
              }}
              data-testid="header-upload-companies"
            >
              Upload companies
            </MenuItem>
            {hasContacts && (
              <>
                <Divider component="li" sx={{ my: 0.5 }} />
                <MenuItem
                  selected={workspaceMode === 'normalizer'}
                  onClick={() => {
                    setUploadMenuAnchor(null)
                    setWorkspaceMode('normalizer')
                    setActiveTab('contacts')
                  }}
                  data-testid="header-workspace-normalizer"
                >
                  Contact Company Normalizer
                </MenuItem>
                <MenuItem
                  selected={workspaceMode === 'matcher'}
                  onClick={() => {
                    setUploadMenuAnchor(null)
                    setWorkspaceMode('matcher')
                    setActiveTab('contacts')
                  }}
                  data-testid="header-workspace-matcher"
                >
                  Contact Company Matcher
                </MenuItem>
              </>
            )}
          </Menu>
          <IconButton color="inherit" size="small" onClick={onToggleMode} aria-label="Toggle theme">
            {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
        </Toolbar>
      </AppBar>

      <ImportWorkflowDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        entryKind={uploadImportKind}
        hasContacts={hasContacts}
        onImportContacts={handleContactsFileAccepted}
        onImportCompanies={handleCompanyFileAccepted}
      />

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
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              px: 2,
              bgcolor: 'background.default',
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
            {workspaceMode === 'normalizer' && (
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
                  WebkitOverflowScrolling: 'touch',
                }}
              >
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
              </Box>
            </Paper>
            )}

            {workspaceMode === 'normalizer' && aiSearchError && (
              <Alert severity="error" onClose={() => setAiSearchError(null)} sx={{ mb: 2, flexShrink: 0 }}>
                {aiSearchError}
              </Alert>
            )}

            {workspaceMode === null && (
              <Paper variant="outlined" sx={{ p: 3, mb: 2, borderRadius: 2, flexShrink: 0, bgcolor: 'background.paper' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  Choose workflow
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Use the Contact Company Normalizer for LLM search against a parent company, or the Matcher to map
                  import companies to your companies file. Contacts and Companies tabs are available in either mode.
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => {
                      setWorkspaceMode('normalizer')
                      setActiveTab('contacts')
                    }}
                    data-testid="workspace-mode-normalizer"
                  >
                    Contact Company Normalizer
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() => {
                      setWorkspaceMode('matcher')
                      setActiveTab('contacts')
                    }}
                    data-testid="workspace-mode-matcher"
                  >
                    Contact Company Matcher
                  </Button>
                </Box>
                {!matcherCanRun && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                    Matcher needs a companies file and a company column on your contacts.
                  </Typography>
                )}
              </Paper>
            )}

            {workspaceMode !== null && (
              <>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-end',
                flexShrink: 0,
                borderBottom: 1,
                borderColor: 'divider',
                gap: 0,
              }}
            >
              <Tabs
                value={
                  activeTab === 'contacts' ||
                  activeTab === 'companies' ||
                  activeTab === 'normalizer' ||
                  activeTab === 'matcher'
                    ? activeTab
                    : false
                }
                onChange={(_, v: TabValue) => setActiveTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{
                  flex: '0 1 auto',
                  minHeight: 40,
                  mb: 0,
                  borderBottom: 0,
                  maxWidth: { xs: '100%', md: '70%' },
                  '& .MuiTab-root': { minHeight: 40, py: 0.5, fontSize: '0.8rem', textTransform: 'none' },
                }}
                textColor="primary"
                indicatorColor="primary"
                data-testid="tabs-main"
              >
                <Tab label="Contacts" value="contacts" data-testid="tab-contacts" />
                <Tab label="Companies" value="companies" data-testid="tab-companies" />
                {workspaceMode === 'normalizer' && (
                  <Tab
                    label="Contact Company Normalizer"
                    value="normalizer"
                    data-testid="tab-results-normalizer"
                  />
                )}
                {workspaceMode === 'matcher' && (
                  <Tab
                    label="Contact Company Matcher"
                    value="matcher"
                    data-testid="tab-results-matcher"
                  />
                )}
              </Tabs>
              <Box sx={{ flex: 1, minWidth: 8 }} aria-hidden />
              <Tabs
                value={
                  activeTab === 'companyKey' ||
                  activeTab === 'contactCompanyKey' ||
                  activeTab === 'contactCompanyMatch'
                    ? activeTab
                    : false
                }
                onChange={(_, v: TabValue) => setActiveTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{
                  flex: '0 0 auto',
                  minHeight: 40,
                  mb: 0,
                  borderBottom: 0,
                  '& .MuiTab-root': { minHeight: 40, py: 0.5, fontSize: '0.8rem', textTransform: 'none' },
                }}
                textColor="primary"
                indicatorColor="primary"
                data-testid="tabs-key-reference"
              >
                <Tab label="Company Key" value="companyKey" data-testid="tab-company-key" />
                <Tab label="Contact Company Key" value="contactCompanyKey" data-testid="tab-contact-company-key" />
                <Tab
                  label="Contact Company Match"
                  value="contactCompanyMatch"
                  data-testid="tab-contact-company-match"
                />
              </Tabs>
            </Box>

            <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', pt: 2 }}>
            {activeTab === 'contacts' && (
              <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, flexShrink: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    {matcherStartToolbarButton}
                    <Typography variant="subtitle2" color="primary">
                      Import list — {contacts.length.toLocaleString()} row{contacts.length !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
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
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        flexWrap: 'wrap',
                        mb: 1,
                        flexShrink: 0,
                      }}
                    >
                      {matcherStartToolbarButton}
                      <Typography variant="subtitle2" color="primary">
                        {companyFileName} — {companies.length.toLocaleString()} row{companies.length !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                      <AgCompaniesGrid companies={companies} headers={companyHeaders} fillContainer />
                    </Box>
                  </>
                )}
              </Box>
            )}

            {activeTab === 'normalizer' && (
              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  gap: 1.5,
                }}
              >
                {showNormalizerActivity && normalizerLogVisible && (
                  <Paper
                    variant="outlined"
                    data-testid="normalizer-run-log"
                    sx={{
                      flexShrink: 0,
                      p: 1,
                      maxHeight: 'min(40vh, 320px)',
                      overflow: 'auto',
                      borderRadius: 1,
                      bgcolor: 'action.hover',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 0.5,
                        mb: 0.5,
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Activity
                      </Typography>
                      <Tooltip title="Hide activity">
                        <IconButton
                          size="small"
                          aria-label="Hide activity"
                          onClick={() => setNormalizerLogVisible(false)}
                          data-testid="normalizer-run-log-hide"
                          sx={{ p: 0.25 }}
                        >
                          <ExpandLessIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    {aiSearchLoading && (
                      <Box sx={{ mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <CircularProgress size={16} color="primary" />
                          <Typography variant="caption" color="text.secondary">
                            LLM searching…
                          </Typography>
                        </Box>
                        <LinearProgress variant="indeterminate" sx={{ borderRadius: 1 }} />
                      </Box>
                    )}
                    {processLogLines.length === 0 ? (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
                      >
                        LLM: Starting…
                      </Typography>
                    ) : (
                      processLogLines.map((line, i) => (
                        <Typography
                          key={`normalizer-log-${i}`}
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
                          {line}
                        </Typography>
                      ))
                    )}
                    <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1, fontWeight: 500 }}>
                      LLM results may be incorrect or inaccurate. Please check results.
                    </Typography>
                  </Paper>
                )}
                {showNormalizerActivity && !normalizerLogVisible && (
                  <Box sx={{ flexShrink: 0 }}>
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<ExpandMoreIcon />}
                      onClick={() => setNormalizerLogVisible(true)}
                      data-testid="normalizer-run-log-show"
                      sx={{ alignSelf: 'flex-start', py: 0.25, px: 0.5, fontSize: '0.75rem' }}
                    >
                      Show activity
                    </Button>
                  </Box>
                )}

                {matchingCompanyNames.length === 0 && !showNormalizerActivity ? (
                  <Box sx={{ py: 4, flexShrink: 0 }}>
                    <Typography color="text.secondary">
                      Select a company and run Contact Company Normalizer to see matching contacts here.
                    </Typography>
                  </Box>
                ) : matchingCompanyNames.length === 0 ? (
                  <Box sx={{ py: 2, flexShrink: 0 }}>
                    <Typography color="text.secondary">
                      {aiSearchLoading
                        ? 'Search in progress… Results will appear here when complete.'
                        : 'No matching import strings were returned for this search.'}
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
                      {exportError && (
                        <Alert severity="error" onClose={() => setExportError(null)} sx={{ mb: 1, flexShrink: 0 }}>
                          {exportError}
                        </Alert>
                      )}
                      <Paper
                        variant="outlined"
                        sx={{
                          px: 1,
                          py: 0.5,
                          mb: 0.75,
                          flexShrink: 0,
                          borderRadius: 1,
                          bgcolor: 'action.hover',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.75,
                          flexWrap: 'nowrap',
                          overflowX: 'auto',
                        }}
                      >
                        {companyColumnKey && (
                          <>
                            <Tooltip
                              title={`Set “${companyColumnKey}” to one value on every row (table, export, CRM).`}
                              placement="top"
                            >
                              <Typography
                                variant="caption"
                                component="span"
                                sx={{
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                  fontSize: '0.7rem',
                                  lineHeight: 1.2,
                                  cursor: 'default',
                                }}
                              >
                                {companyColumnKey} · all rows
                              </Typography>
                            </Tooltip>
                            <TextField
                              size="small"
                              placeholder={inferredParentCompany?.trim() || 'Company value…'}
                              value={companyNameOverrideInput}
                              onChange={(e) => setCompanyNameOverrideInput(e.target.value)}
                              sx={{
                                flex: '1 1 140px',
                                minWidth: 140,
                                maxWidth: 340,
                                '& .MuiOutlinedInput-root': {
                                  height: 30,
                                  fontSize: '0.75rem',
                                },
                                '& .MuiOutlinedInput-input': { py: 0.5, px: 1 },
                              }}
                              data-testid="normalizer-bulk-company-input"
                            />
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.375,
                                flexShrink: 0,
                              }}
                            >
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => {
                                  const v = companyNameOverrideInput.trim()
                                  setOverrideCompanyName(v || null)
                                }}
                                data-testid="normalizer-bulk-company-apply"
                                sx={{
                                  py: 0.25,
                                  px: 0.875,
                                  minHeight: 28,
                                  fontSize: '0.7rem',
                                  lineHeight: 1.2,
                                  textTransform: 'none',
                                }}
                              >
                                Apply
                              </Button>
                              <Tooltip title="Fill from inferred parent company">
                                <span>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    disabled={!inferredParentCompany?.trim()}
                                    onClick={() => {
                                      const v = (inferredParentCompany ?? '').trim()
                                      if (!v) return
                                      setCompanyNameOverrideInput(v)
                                      setOverrideCompanyName(v)
                                    }}
                                    sx={{
                                      py: 0.25,
                                      px: 0.75,
                                      minHeight: 28,
                                      fontSize: '0.7rem',
                                      lineHeight: 1.2,
                                      textTransform: 'none',
                                    }}
                                  >
                                    Parent
                                  </Button>
                                </span>
                              </Tooltip>
                              <Button
                                size="small"
                                variant="text"
                                disabled={overrideCompanyName == null && companyNameOverrideInput.trim() === ''}
                                onClick={() => {
                                  setOverrideCompanyName(null)
                                  setCompanyNameOverrideInput('')
                                }}
                                data-testid="normalizer-bulk-company-clear"
                                sx={{
                                  py: 0.25,
                                  px: 0.5,
                                  minHeight: 28,
                                  fontSize: '0.7rem',
                                  lineHeight: 1.2,
                                  textTransform: 'none',
                                }}
                              >
                                Clear
                              </Button>
                            </Box>
                          </>
                        )}
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            flexShrink: 0,
                            ml: 'auto',
                          }}
                        >
                          <Tooltip title="Download results as CSV">
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
                              onClick={handleExportResults}
                              data-testid="export-results-button"
                              sx={{
                                py: 0.25,
                                px: 0.75,
                                minHeight: 28,
                                fontSize: '0.7rem',
                                lineHeight: 1.2,
                                textTransform: 'none',
                              }}
                            >
                              Export
                            </Button>
                          </Tooltip>
                          <CrmExportFeature
                            contacts={aiResultsContactsWithDescription}
                            headers={aiResultsHeaders}
                            compact
                          />
                          <Tooltip title="Remove these records from the import list">
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={handleRemoveResultsFromImport}
                              data-testid="remove-from-import-button"
                              sx={{
                                py: 0.25,
                                px: 0.75,
                                minHeight: 28,
                                fontSize: '0.7rem',
                                lineHeight: 1.2,
                                textTransform: 'none',
                              }}
                            >
                              Remove
                            </Button>
                          </Tooltip>
                        </Box>
                      </Paper>
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
                      <Accordion
                        defaultExpanded
                        sx={{
                          mb: 1,
                          borderRadius: 1,
                          '&:before': { display: 'none' },
                          border: 1,
                          borderColor: 'divider',
                        }}
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
                    </Paper>
                  </Box>
                )}
              </Box>
            )}

            {activeTab === 'matcher' && (
              <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {matcherKeybookCoverage != null && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ flexShrink: 0, mb: 0.5 }}
                    data-testid="matcher-keybook-coverage"
                  >
                    Keybook coverage — Company Key: {matcherKeybookCoverage.companyKeyWithParent.toLocaleString()} /{' '}
                    {matcherKeybookCoverage.companyKeyTotal.toLocaleString()} names with parent. Contact Company Key:{' '}
                    {matcherKeybookCoverage.contactKeyWithParent.toLocaleString()} /{' '}
                    {matcherKeybookCoverage.contactKeyTotal.toLocaleString()} import strings with parent. When both
                    fractions are full, the matcher skips step 1 and step 2 LLM parent passes (step 3 + optional
                    fallback may still run).
                  </Typography>
                )}
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
                  matcherParentByRaw={matcherParentByRaw}
                  matcherParentByCanon={matcherParentByCanon}
                  onSelectionChange={handleMatcherSelectionChange}
                  onRun={handleRunMatcher}
                />
              </Box>
            )}

            {activeTab === 'companyKey' && (
              <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {!hasCompanies ? (
                  <Typography color="text.secondary" variant="body2">
                    Import a companies file to see the Company Key.
                  </Typography>
                ) : (
                  <>
                    <Typography variant="caption" color="text.secondary">
                      Canonical names from your companies file (Name column). Parent labels appear after you run the
                      Contact Company Matcher.
                    </Typography>
                    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                      <ParentKeyGrid
                        rows={companyKeyRows}
                        nameHeader="Company"
                        fillContainer
                        data-testid="company-key-grid"
                      />
                    </Box>
                  </>
                )}
              </Box>
            )}

            {activeTab === 'contactCompanyKey' && (
              <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {!companyColumnKey || uniqueCompanyNames.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">
                    Import contacts with a company column to see the Contact Company Key.
                  </Typography>
                ) : (
                  <>
                    <Typography variant="caption" color="text.secondary">
                      Unique company strings from your contacts. Parent labels fill in after the matcher runs; if a row
                      was served from cache without a per-import parent, the parent of your selected match is used when
                      available.
                    </Typography>
                    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                      <ParentKeyGrid
                        rows={contactCompanyKeyRows}
                        nameHeader="Contact company"
                        fillContainer
                        data-testid="contact-company-key-grid"
                      />
                    </Box>
                  </>
                )}
              </Box>
            )}

            {activeTab === 'contactCompanyMatch' && (
              <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Persisted on the server after each successful matcher run (contact-company-match.jsonl). CRM company
                  is the master-list label from your companies import for the matched row (Name, or CRM Company when
                  that column is present). Matched company is the closed-list pick; parent company is the inferred parent
                  for that import string (may be empty).
                </Typography>
                <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <MatchKeyGrid
                    rows={contactCompanyMatchGridRows}
                    fillContainer
                    data-testid="contact-company-match-grid"
                    matchedOnly={contactCompanyMatchMatchedOnly}
                  />
                </Box>
              </Box>
            )}
            </Box>
              </>
            )}
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
