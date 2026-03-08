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
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { keyframes } from '@mui/system'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import SearchIcon from '@mui/icons-material/Search'
import DownloadIcon from '@mui/icons-material/Download'
import { getAppTheme } from './theme'
import { parseContactFile, type ContactRow } from './utils/parseFile'
import { downloadCsv, sanitizeFilenameSegment } from './utils/exportCsv'
import { UploadDropZone } from './components/UploadDropZone'
import { ContactsTable } from './components/ContactsTable'
import { CompanySelect } from './components/CompanySelect'
import { postChat, type ReasoningStep } from './api/chat'

type TabValue = 'contacts' | 'aiResults'

const logShimmer = keyframes`
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
`

function AppContent({ mode, onToggleMode }: { mode: 'light' | 'dark'; onToggleMode: () => void }) {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [companyColumnKey, setCompanyColumnKey] = useState<string | null>(null)
  const [entityColumnKey, setEntityColumnKey] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
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
  const [processLogLines, setProcessLogLines] = useState<string[]>([])
  const processLogIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleFileAccepted = useCallback(async (file: File) => {
    setParseError(null)
    setSelectedCompany(null)
    setMatchingCompanyNames([])
    setExcludedMatchNames([])
    setAiSearchError(null)
    setExportError(null)
    setReasoningSteps(null)
    setOverrideCompanyName(null)
    setCompanyNameOverrideInput('')
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

  const uniqueCompanyNames = useMemo(() => {
    if (!companyColumnKey || !contacts.length) return []
    const set = new Set<string>()
    for (const row of contacts) {
      const v = row[companyColumnKey]
      if (v != null && String(v).trim() !== '') set.add(String(v).trim())
    }
    return Array.from(set)
  }, [contacts, companyColumnKey])

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

  const { aiResultsHeaders, aiResultsContactsWithDescription } = useMemo(() => {
    const extendedHeaders = [...headers, 'Parent company']
    const withDescription: ContactRow[] = aiResultsContacts.map((row) => ({
      ...row,
      'Parent company': inferredParentCompany ?? '',
      ...(companyColumnKey != null && overrideCompanyName != null ? { [companyColumnKey]: overrideCompanyName } : {}),
    }))
    return { aiResultsHeaders: extendedHeaders, aiResultsContactsWithDescription: withDescription }
  }, [headers, aiResultsContacts, inferredParentCompany, overrideCompanyName, companyColumnKey])

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
      setTimeout(() => setAiSearchLoading(false), 2000)
    }
  }, [effectiveCompany, companyColumnKey, uniqueCompanyNames, aiSearchLoading])

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

  const hasFile = contacts.length > 0

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
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onFileAccepted={handleFileAccepted}
      />

      <Dialog open={aiSearchLoading} disableEscapeKeyDown maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
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
            This data is being computed by an LLM. It may be inaccurate or incomplete. Please check before using.
          </Typography>
        </DialogContent>
      </Dialog>

      <Container maxWidth="xl" sx={{ flex: 1, display: 'flex', flexDirection: 'column', py: 2, minHeight: 0, overflow: 'auto', position: 'relative' }} data-testid="main-content">
        {parseError && (
          <Alert severity="error" onClose={() => setParseError(null)} sx={{ mb: 2 }}>
            {parseError}
          </Alert>
        )}

        {!hasFile && (
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
                maxWidth: 480,
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
                Upload a CSV or Excel file with contacts (Name, Email, Company, etc.).
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<UploadFileIcon />}
                onClick={() => setUploadOpen(true)}
                sx={{ minWidth: 160 }}
                data-testid="upload-trigger"
              >
                Upload file
              </Button>
            </Paper>
          </Box>
        )}

        {hasFile && (
          <>
            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: 'background.default' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="body2" color="text.secondary">
                  {fileName} — {contacts.length.toLocaleString()} rows
                  {companyColumnKey ? ` · Company column: "${companyColumnKey}"` : ' · No company column'}
                </Typography>
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
                  data-testid="ai-search-button"
                >
                  AI Search
                </Button>
              </Box>
            </Paper>

            {aiSearchError && (
              <Alert severity="error" onClose={() => setAiSearchError(null)} sx={{ mb: 2 }}>
                {aiSearchError}
              </Alert>
            )}

            <Tabs value={activeTab} onChange={(_, v: TabValue) => setActiveTab(v)} sx={{ mb: 2, minHeight: 48 }} textColor="primary" indicatorColor="primary" data-testid="tabs-contacts-ai">
              <Tab label="Contacts" value="contacts" data-testid="tab-contacts" />
              <Tab label="AI Results" value="aiResults" data-testid="tab-ai-results" />
            </Tabs>

            {activeTab === 'contacts' && (
<ContactsTable
                  contacts={contacts}
                  headers={headers}
                  maxHeight={520}
                  companyColumnKey={companyColumnKey}
                  entityColumnKey={entityColumnKey}
                />
            )}

            {activeTab === 'aiResults' && (
              <Box>
                {matchingCompanyNames.length === 0 ? (
                  <Box sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      Select a company and click AI Search to see matching contacts here.
                    </Typography>
                  </Box>
                ) : (
                  <>
                    <Typography variant="subtitle2" color="primary" sx={{ mb: 2 }}>
                      {aiResultsContacts.length.toLocaleString()} contacts matching your search.
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
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<DownloadIcon />}
                          onClick={handleExportResults}
                          data-testid="export-results-button"
                        >
                          Export results
                        </Button>
                      </Box>
                      {exportError && (
                        <Alert severity="error" onClose={() => setExportError(null)} sx={{ mb: 1 }}>
                          {exportError}
                        </Alert>
                      )}
                      <Box sx={{ minHeight: 440 }}>
                        <ContactsTable
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
