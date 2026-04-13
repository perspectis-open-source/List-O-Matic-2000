/**
 * @file App.tsx
 * @description Main application: tabs (Contacts / Companies / Results), upload, company select, Contact Company Normalizer / Matcher (UI), and results table.
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
import { postMatchCompaniesBatched } from './api/matchCompanies'
import { CrmExportFeature } from './components/CrmExportFeature'
import { MatcherReviewPanel, type MatcherRowModel } from './components/MatcherReviewPanel'
import {
  canonicalNamesFromCompanies,
  matchDeterministicBatch,
  pickMatchedCompanyHeader,
  topKForLlm,
} from './utils/companyMatch'

type TabValue = 'contacts' | 'companies' | 'aiResults'

type AiResultsSubTab = 'normalizer' | 'matcher'

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
  const [aiResultsSubTab, setAiResultsSubTab] = useState<AiResultsSubTab>('normalizer')
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

  const handleRunMatcher = useCallback(async () => {
    if (!companyColumnKey || !contacts.length || !companies.length) return
    setMatcherError(null)
    setMatcherRunning(true)
    setMatcherRows([])
    try {
      const canon = canonicalNamesFromCompanies(companies)
      const raws = uniqueCompanyNames
      const det = matchDeterministicBatch(raws, canon)
      const llmItems = det
        .filter((d) => d.tier === 'needs_llm')
        .map((d) => ({ raw: d.raw, topCandidates: topKForLlm(d) }))

      const llmByRaw = new Map<string, { match: string | null; alternates?: string[] }>()
      if (llmItems.length > 0) {
        const llmResults = await postMatchCompaniesBatched(canon, llmItems)
        for (const r of llmResults) {
          llmByRaw.set(r.raw, { match: r.match, alternates: r.alternates })
        }
      }

      const rows: MatcherRowModel[] = []
      const initSel: Record<string, string> = {}

      for (const d of det) {
        const contactCount = matcherContactCounts.get(d.raw) ?? 0
        const llm = llmByRaw.get(d.raw)
        const source: MatcherRowModel['source'] =
          d.tier === 'needs_llm' ? 'llm' : d.tier === 'ambiguous' ? 'ambiguous' : 'auto'

        const hints = new Set<string>()
        for (const t of d.topCandidates) hints.add(t.name)
        if (llm?.match) hints.add(llm.match)
        if (llm?.alternates) for (const a of llm.alternates) hints.add(a)

        let suggested: string | null = null
        if (d.tier === 'auto' && d.best) suggested = d.best
        else if (llm?.match && canon.includes(llm.match)) suggested = llm.match
        else if (d.topCandidates[0]) suggested = d.topCandidates[0].name

        rows.push({
          raw: d.raw,
          source,
          contactCount,
          suggested,
          optionHints: [...hints],
        })

        if (d.tier === 'auto' && d.best) initSel[d.raw] = d.best
        else if (llm?.match && canon.includes(llm.match)) initSel[d.raw] = llm.match
        else if (d.tier === 'ambiguous' && d.topCandidates[0]) initSel[d.raw] = d.topCandidates[0].name
        else initSel[d.raw] = ''
      }

      rows.sort((a, b) => a.raw.localeCompare(b.raw))
      setMatcherRows(rows)
      setMatcherSelections(initSel)
    } catch (e) {
      setMatcherError(e instanceof Error ? e.message : 'Matcher failed')
    } finally {
      setMatcherRunning(false)
    }
  }, [companyColumnKey, companies, uniqueCompanyNames, matcherContactCounts])

  const handleMatcherSelectionChange = useCallback((raw: string, value: string) => {
    setMatcherSelections((prev) => ({ ...prev, [raw]: value }))
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
    setActiveTab('aiResults')
    setAiResultsSubTab('matcher')
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
      setAiResultsSubTab('normalizer')
      setActiveTab('aiResults')
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
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      <AppBar position="static" elevation={0} sx={{ width: '100%', borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ width: '100%', maxWidth: '100%', px: { xs: 2, sm: 3 }, gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h6" component="div" sx={{ flex: 1 }}>
            List-O-Matic 2000
          </Typography>
          <IconButton color="inherit" onClick={onToggleMode} aria-label="Toggle theme">
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
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

      <Container maxWidth="xl" sx={{ flex: 1, display: 'flex', flexDirection: 'column', py: 2, minHeight: 0, overflow: 'auto', position: 'relative' }} data-testid="main-content">
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
              top: 56,
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
          <>
            {companyParseError && (
              <Alert severity="error" onClose={() => setCompanyParseError(null)} sx={{ mb: 2 }}>
                {companyParseError}
              </Alert>
            )}
            {parseError && (
              <Alert severity="error" onClose={() => setParseError(null)} sx={{ mb: 2 }}>
                {parseError}
              </Alert>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {companyFileName} — {companies.length.toLocaleString()} company row{companies.length !== 1 ? 's' : ''}
            </Typography>
            <Typography variant="body1" color="text.primary" sx={{ mb: 2 }}>
              Upload a contacts file to use Contact Company Normalizer and the full workspace.
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => openUpload('contacts')} data-testid="upload-contacts-from-companies-only">
                Import contacts
              </Button>
            </Box>
            <AgCompaniesGrid companies={companies} headers={companyHeaders} maxHeight={560} />
          </>
        )}

        {hasContacts && (
          <>
            {parseError && (
              <Alert severity="error" onClose={() => setParseError(null)} sx={{ mb: 2 }}>
                {parseError}
              </Alert>
            )}
            {companyParseError && (
              <Alert severity="error" onClose={() => setCompanyParseError(null)} sx={{ mb: 2 }}>
                {companyParseError}
              </Alert>
            )}
            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: 'background.default' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="body2" color="text.secondary">
                  {fileName} — {contacts.length.toLocaleString()} rows
                  {companyColumnKey ? ` · Company column: "${companyColumnKey}"` : ' · No company column'}
                </Typography>
                {hasCompanies && companyFileName && (
                  <Typography variant="body2" color="text.secondary">
                    Companies: {companyFileName} — {companies.length.toLocaleString()} row{companies.length !== 1 ? 's' : ''}
                  </Typography>
                )}
                <Button variant="outlined" size="small" startIcon={<UploadFileIcon />} onClick={() => openUpload('companies')} data-testid="import-companies-toolbar">
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
                <Button
                  variant="contained"
                  startIcon={aiSearchLoading ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
                  onClick={handleAiSearch}
                  disabled={!effectiveCompany || !companyColumnKey || aiSearchLoading}
                  data-testid="contact-company-normalizer-button"
                >
                  Contact Company Normalizer
                </Button>
                <Tooltip
                  title={
                    matcherCanRun
                      ? 'Open the Matcher tab and run matching against your companies list.'
                      : 'Import a companies file and ensure contacts include a company column.'
                  }
                >
                  <span>
                    <Button
                      variant="outlined"
                      disabled={!matcherCanRun || matcherRunning}
                      onClick={handleMatcherToolbarClick}
                      data-testid="contact-company-matcher-button"
                    >
                      Contact Company Matcher
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            </Paper>

            {aiSearchError && (
              <Alert severity="error" onClose={() => setAiSearchError(null)} sx={{ mb: 2 }}>
                {aiSearchError}
              </Alert>
            )}

            <Tabs value={activeTab} onChange={(_, v: TabValue) => setActiveTab(v)} sx={{ mb: 2, minHeight: 48 }} textColor="primary" indicatorColor="primary" data-testid="tabs-main">
              <Tab label="Contacts" value="contacts" data-testid="tab-contacts" />
              <Tab label="Companies" value="companies" data-testid="tab-companies" />
              <Tab label="Results" value="aiResults" data-testid="tab-results" />
            </Tabs>

            {activeTab === 'contacts' && (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1 }}>
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
                <AgContactsGrid
                  contacts={contacts}
                  headers={headers}
                  maxHeight={520}
                  companyColumnKey={companyColumnKey}
                  entityColumnKey={entityColumnKey}
                />
              </Box>
            )}

            {activeTab === 'companies' && (
              <Box>
                {!hasCompanies ? (
                  <Box sx={{ py: 2 }}>
                    <Typography color="text.secondary" sx={{ mb: 2 }}>
                      No companies file loaded yet.
                    </Typography>
                    <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => openUpload('companies')}>
                      Import companies
                    </Button>
                  </Box>
                ) : (
                  <>
                    <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                      {companyFileName} — {companies.length.toLocaleString()} row{companies.length !== 1 ? 's' : ''}
                    </Typography>
                    <AgCompaniesGrid companies={companies} headers={companyHeaders} maxHeight={520} />
                  </>
                )}
              </Box>
            )}

            {activeTab === 'aiResults' && (
              <Box>
                <Tabs
                  value={aiResultsSubTab}
                  onChange={(_, v: AiResultsSubTab) => setAiResultsSubTab(v)}
                  sx={{ mb: 2, minHeight: 44, borderBottom: 1, borderColor: 'divider' }}
                  textColor="primary"
                  indicatorColor="primary"
                  data-testid="tabs-results-sub"
                >
                  <Tab
                    label="Contact Company Normalizer"
                    value="normalizer"
                    data-testid="tab-results-normalizer"
                  />
                  <Tab label="Contact Company Matcher" value="matcher" data-testid="tab-results-matcher" />
                </Tabs>

                {aiResultsSubTab === 'normalizer' && (
                  <>
                    {matchingCompanyNames.length === 0 ? (
                      <Box sx={{ py: 4 }}>
                        <Typography color="text.secondary">
                          Select a company and run Contact Company Normalizer to see matching contacts here.
                        </Typography>
                      </Box>
                    ) : (
                      <>
                        <Typography variant="subtitle2" color="primary" sx={{ mb: 2 }}>
                          {displayedAiResultRows.length.toLocaleString()} contacts matching your search.
                        </Typography>
                        {reasoningSteps != null && reasoningSteps.length > 0 && (
                          <Accordion defaultExpanded={false} sx={{ mb: 2, borderRadius: 2, '&:before': { display: 'none' }, border: 1, borderColor: 'divider' }}>
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
                        <Accordion defaultExpanded={false} sx={{ mb: 2, borderRadius: 2, '&:before': { display: 'none' }, border: 1, borderColor: 'divider' }}>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="subtitle2" color="primary">
                              List entries matched to parent company
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails sx={{ pt: 0 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              {matchingCompanyNames.length} string(s) from your upload that the LLM matched to the parent company. These are not company names—they are the imported data (variants, misspellings, brand names as entered) that will be normalized to the parent.
                            </Typography>
                            <List dense sx={{ maxHeight: 200, overflowY: 'scroll' }}>
                              {(() => {
                                const excludedSet = new Set(excludedMatchNames)
                                return [...matchingCompanyNames].sort((a, b) => a.localeCompare(b)).map((name) => {
                                  const included = !excludedSet.has(name)
                                  return (
                                  <ListItem
                                    key={name}
                                    sx={{ py: 0 }}
                                    disablePadding
                                  >
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                          <TextField
                            size="small"
                            label="Set company name for all results"
                            placeholder="e.g. Apple Inc."
                            value={companyNameOverrideInput}
                            onChange={(e) => setCompanyNameOverrideInput(e.target.value)}
                            sx={{ minWidth: 280, flex: 1 }}
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
                        <Box sx={{ mt: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                            <Typography variant="subtitle2" color="primary">
                              Results table — {aiResultsContactsWithDescription.length.toLocaleString()} row{aiResultsContactsWithDescription.length !== 1 ? 's' : ''}
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
                            <Alert severity="error" onClose={() => setExportError(null)} sx={{ mb: 1 }}>
                              {exportError}
                            </Alert>
                          )}
                          <Box sx={{ minHeight: 440 }}>
                            <AgContactsGrid
                              contacts={aiResultsContactsWithDescription}
                              headers={aiResultsHeaders}
                              maxHeight={420}
                              companyColumnKey={companyColumnKey}
                              entityColumnKey={entityColumnKey}
                            />
                          </Box>
                        </Box>
                      </>
                    )}
                  </>
                )}

                {aiResultsSubTab === 'matcher' && (
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
                    onSelectionChange={handleMatcherSelectionChange}
                    onRun={handleRunMatcher}
                    onApply={handleApplyMatcher}
                  />
                )}
              </Box>
            )}
          </>
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
      <Box sx={{ width: '100%', minHeight: '100vh' }}>
        <AppContent mode={mode} onToggleMode={onToggleMode} />
      </Box>
    </ThemeProvider>
  )
}
