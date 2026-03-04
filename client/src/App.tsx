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
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  Checkbox,
  FormControlLabel,
} from '@mui/material'
import { keyframes } from '@mui/system'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import SearchIcon from '@mui/icons-material/Search'
import DownloadIcon from '@mui/icons-material/Download'
import { getAppTheme } from './theme'
import { parseContactFile, type ContactRow } from './utils/parseFile'
import { downloadCsv, sanitizeFilenameSegment } from './utils/exportCsv'
import { postMatchCompanies } from './api/matchCompanies'
import { UploadDropZone } from './components/UploadDropZone'
import { ContactsTable } from './components/ContactsTable'
import { CompanySelect } from './components/CompanySelect'
import { CrmCompanyList } from './components/CrmCompanyList'
import { DemoSlide } from './components/DemoSlide'
import { SLIDES } from './slides'
import { postChat, type ReasoningStep, type ToolCall } from './api/chat'

type TabValue = 'contacts' | 'aiResults'
type FeatureTab = 'contactSearch' | 'contactMatch'
type ContactMatchTabValue = 'companies' | 'contactList'

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
  const [inferredParentCompany, setInferredParentCompany] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabValue>('contacts')
  const [aiSearchLoading, setAiSearchLoading] = useState(false)
  const [aiSearchError, setAiSearchError] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [reasoningSteps, setReasoningSteps] = useState<ReasoningStep[] | null>(null)
  const [toolCalls, setToolCalls] = useState<ToolCall[] | null>(null)
  const [lastAiSearchMessage, setLastAiSearchMessage] = useState<string | null>(null)
  const [refineInput, setRefineInput] = useState('')
  const [refineLoading, setRefineLoading] = useState(false)
  const [processLogLines, setProcessLogLines] = useState<string[]>([])
  const processLogIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [exactMatch, setExactMatch] = useState(false)
  const [featureTab, setFeatureTab] = useState<FeatureTab>('contactSearch')
  const [contactMatchTab, setContactMatchTab] = useState<ContactMatchTabValue>('companies')
  const [crmCompaniesList, setCrmCompaniesList] = useState<string[]>([])
  const [crmUploadOpen, setCrmUploadOpen] = useState(false)
  const [crmParseError, setCrmParseError] = useState<string | null>(null)
  const [contactListData, setContactListData] = useState<ContactRow[]>([])
  const [contactListHeaders, setContactListHeaders] = useState<string[]>([])
  const [contactListFileName, setContactListFileName] = useState<string | null>(null)
  const [contactListCompanyKey, setContactListCompanyKey] = useState<string | null>(null)
  const [contactListEntityKey, setContactListEntityKey] = useState<string | null>(null)
  const [contactListUploadOpen, setContactListUploadOpen] = useState(false)
  const [contactListParseError, setContactListParseError] = useState<string | null>(null)
  const [contactListUpdating, setContactListUpdating] = useState(false)

  const handleFileAccepted = useCallback(async (file: File) => {
    setParseError(null)
    setSelectedCompany(null)
    setMatchingCompanyNames([])
    setAiSearchError(null)
    setExportError(null)
    setReasoningSteps(null)
    setToolCalls(null)
    setLastAiSearchMessage(null)
    setRefineInput('')
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

  const handleCrmCompaniesFileAccepted = useCallback(async (file: File) => {
    setCrmParseError(null)
    try {
      const { data, headers, companyColumnKey } = await parseContactFile(file)
      const key = companyColumnKey || (headers[0] ?? '')
      if (!key) {
        setCrmParseError('No company column found. Use a CSV/Excel with a "Company" column or a first column of names.')
        return
      }
      const set = new Set<string>()
      for (const row of data) {
        const v = row[key]
        if (v != null && String(v).trim() !== '') set.add(String(v).trim())
      }
      setCrmCompaniesList(Array.from(set))
      setCrmUploadOpen(false)
    } catch (e) {
      setCrmParseError(e instanceof Error ? e.message : 'Failed to parse file')
    }
  }, [])

  const handleContactListFileAccepted = useCallback(async (file: File) => {
    setContactListParseError(null)
    try {
      const { data, headers: h, companyColumnKey: key, entityColumnKey: entityKey } = await parseContactFile(file)
      setContactListData(data)
      setContactListHeaders(h)
      setContactListFileName(file.name)
      setContactListCompanyKey(key)
      setContactListEntityKey(entityKey)
      setContactListUploadOpen(false)
    } catch (e) {
      setContactListParseError(e instanceof Error ? e.message : 'Failed to parse file')
    }
  }, [])

  const MATCH_BATCH_SIZE = 200

  const handleUpdateContactCompanies = useCallback(async () => {
    const key = contactListCompanyKey
    if (!key || crmCompaniesList.length === 0 || contactListData.length === 0) return
    setContactListParseError(null)
    setContactListUpdating(true)
    try {
      // Only company name strings from the Company column — no PII (names, emails, phones) sent to LLM
      const uniqueNames = Array.from(new Set(contactListData.map((row) => String(row[key] ?? '').trim()).filter(Boolean)))
      const fullMapping: Record<string, string> = {}
      for (let i = 0; i < uniqueNames.length; i += MATCH_BATCH_SIZE) {
        const chunk = uniqueNames.slice(i, i + MATCH_BATCH_SIZE)
        // Sends only company name strings: chunk + CRM company names. No contact list, no PII.
        const { mapping } = await postMatchCompanies(chunk, crmCompaniesList)
        Object.assign(fullMapping, mapping)
      }
      const updated = contactListData.map((row) => {
        const current = String(row[key] ?? '').trim()
        const matched = current ? (fullMapping[current] ?? current) : current
        return { ...row, [key]: matched }
      })
      setContactListData(updated)
    } catch (e) {
      setContactListParseError(e instanceof Error ? e.message : 'Failed to update company names')
    } finally {
      setContactListUpdating(false)
    }
  }, [contactListCompanyKey, crmCompaniesList, contactListData])

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
    const set = new Set(
      matchingCompanyNames.map((n) => String(n).trim()).filter(Boolean)
    )
    return contacts.filter((row) => {
      const cell = String((row[companyColumnKey] ?? '')).trim()
      return cell && set.has(cell)
    })
  }, [contacts, companyColumnKey, matchingCompanyNames])

  const { aiResultsHeaders, aiResultsContactsWithDescription } = useMemo(() => {
    const extendedHeaders = [...headers, 'Parent company']
    const withDescription: ContactRow[] = aiResultsContacts.map((row) => ({
      ...row,
      'Parent company': inferredParentCompany ?? '',
    }))
    return { aiResultsHeaders: extendedHeaders, aiResultsContactsWithDescription: withDescription }
  }, [headers, aiResultsContacts, inferredParentCompany])

  const effectiveCompany = (selectedCompany?.trim() || companyInputValue?.trim() || '') || null

  const handleAiSearch = useCallback(async () => {
    const company = effectiveCompany
    if (!company || !companyColumnKey || aiSearchLoading) return
    setAiSearchError(null)

    if (exactMatch) {
      setReasoningSteps(null)
      setToolCalls(null)
      setLastAiSearchMessage(`Find everyone that works at ${company} (exact match only)`)
      setMatchingCompanyNames([company.trim()])
      setInferredParentCompany(company.trim())
      setActiveTab('aiResults')
      return
    }

    setReasoningSteps(null)
    setToolCalls(null)
    setInferredParentCompany(null)
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
      setLastAiSearchMessage(message)
      const res = await postChat([{ role: 'user', content: message }], uniqueCompanyNames)
      if (processLogIntervalRef.current) {
        clearInterval(processLogIntervalRef.current)
        processLogIntervalRef.current = null
      }
      setProcessLogLines((prev) => [...prev, 'LLM: Complete.'])
      setMatchingCompanyNames(res.matchingCompanyNames ?? [])
      setInferredParentCompany(res.parentCompany ?? null)
      setReasoningSteps(res.reasoningSteps ?? null)
      setToolCalls(res.toolCalls ?? null)
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
      setInferredParentCompany(null)
      setReasoningSteps(null)
      setToolCalls(null)
      setTimeout(() => setAiSearchLoading(false), 2000)
    }
  }, [effectiveCompany, companyColumnKey, uniqueCompanyNames, aiSearchLoading, exactMatch])

  const handleRefine = useCallback(async () => {
    const trimmed = refineInput.trim()
    if (!trimmed || !lastAiSearchMessage || !companyColumnKey || refineLoading) return
    setAiSearchError(null)
    setProcessLogLines([])
    setRefineLoading(true)

    const refineLogLines = [
      'LLM: Refining results...',
      'LLM: Sending previous matches and your instruction...',
      'LLM: Identifying parent and subsidiaries from instruction...',
      'LLM: Updating match list...',
      'LLM: Validating matches...',
      'LLM: Preparing updated results...',
    ]
    let step = 0
    processLogIntervalRef.current = setInterval(() => {
      setProcessLogLines((prev) => (step < refineLogLines.length ? [...prev, refineLogLines[step++]] : prev))
      if (step >= refineLogLines.length && processLogIntervalRef.current) {
        clearInterval(processLogIntervalRef.current)
        processLogIntervalRef.current = null
      }
    }, 600)

    try {
      const res = await postChat(
        [
          { role: 'user', content: lastAiSearchMessage },
          { role: 'user', content: trimmed },
        ],
        uniqueCompanyNames,
        matchingCompanyNames,
        selectedCompany ?? undefined
      )
      if (processLogIntervalRef.current) {
        clearInterval(processLogIntervalRef.current)
        processLogIntervalRef.current = null
      }
      setProcessLogLines((prev) => [...prev, 'LLM: Complete.'])
      setMatchingCompanyNames(res.matchingCompanyNames ?? [])
      if (res.parentCompany != null) setInferredParentCompany(res.parentCompany)
      setReasoningSteps(res.reasoningSteps ?? null)
      setToolCalls(res.toolCalls ?? null)
      setRefineInput('')
      setTimeout(() => setRefineLoading(false), 1200)
    } catch (e) {
      if (processLogIntervalRef.current) {
        clearInterval(processLogIntervalRef.current)
        processLogIntervalRef.current = null
      }
      setProcessLogLines((prev) => [...prev, `LLM: Error — ${e instanceof Error ? e.message : 'Refine request failed'}`])
      setAiSearchError(e instanceof Error ? e.message : 'Refine request failed')
      setTimeout(() => setRefineLoading(false), 2000)
    }
  }, [refineInput, lastAiSearchMessage, selectedCompany, companyColumnKey, uniqueCompanyNames, matchingCompanyNames, refineLoading])

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
          <Typography variant="h6" component="div" sx={{ mr: 2 }}>
            Marketing Demo — Contact List + AI
          </Typography>
          <Tabs
            value={featureTab}
            onChange={(_, v: FeatureTab) => setFeatureTab(v)}
            textColor="inherit"
            indicatorColor="inherit"
            sx={{ minHeight: 40, flex: 1, minWidth: 0, '& .MuiTab-root': { color: 'inherit', minHeight: 48, opacity: 0.9 }, '& .Mui-selected': { color: 'primary.main', fontWeight: 600, opacity: 1 }, '& .MuiTabs-indicator': { backgroundColor: 'primary.main' }, '& .MuiTabs-flexContainer': { gap: 0 } }}
          >
            <Tab label="Contact search" value="contactSearch" />
            <Tab label="Contact match" value="contactMatch" />
          </Tabs>
          <IconButton color="inherit" onClick={onToggleMode} aria-label="Toggle theme" sx={{ ml: 'auto' }}>
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
        </Toolbar>
      </AppBar>

      <UploadDropZone
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onFileAccepted={handleFileAccepted}
      />
      <UploadDropZone
        open={crmUploadOpen}
        onClose={() => { setCrmUploadOpen(false); setCrmParseError(null) }}
        onFileAccepted={handleCrmCompaniesFileAccepted}
      />
      <UploadDropZone
        open={contactListUploadOpen}
        onClose={() => { setContactListUploadOpen(false); setContactListParseError(null) }}
        onFileAccepted={handleContactListFileAccepted}
      />

      <Dialog open={aiSearchLoading || refineLoading} disableEscapeKeyDown maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={24} color="primary" />
          {refineLoading ? 'LLM refining results...' : 'LLM searching...'}
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
        </DialogContent>
      </Dialog>

      <Container maxWidth="xl" sx={{ flex: 1, display: 'flex', flexDirection: 'column', py: 2, minHeight: 0, overflow: 'auto', position: 'relative' }}>
        {featureTab === 'contactMatch' && (
          <Box>
            <Tabs value={contactMatchTab} onChange={(_, v: ContactMatchTabValue) => setContactMatchTab(v)} sx={{ mb: 2, minHeight: 48 }} textColor="primary" indicatorColor="primary">
              <Tab label="Companies" value="companies" />
              <Tab label="Contact list" value="contactList" />
            </Tabs>
            {contactMatchTab === 'companies' && (
              <>
                {crmParseError && (
                  <Alert severity="error" onClose={() => setCrmParseError(null)} sx={{ mb: 2 }}>
                    {crmParseError}
                  </Alert>
                )}
                <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => setCrmUploadOpen(true)}>
                      Upload companies
                    </Button>
                    <Typography variant="body2" color="text.secondary">
                      CSV or Excel with a &quot;Company&quot; column (or first column). Replaces the list below.
                    </Typography>
                  </Box>
                </Paper>
                {crmCompaniesList.length === 0 ? (
                  <Paper variant="outlined" sx={{ p: 4, borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="body1" color="text.secondary">
                      No companies yet. Upload a CSV or Excel file above (e.g. the 500 companies template).
                    </Typography>
                  </Paper>
                ) : (
                  <CrmCompanyList companies={crmCompaniesList} maxHeight={520} />
                )}
              </>
            )}
            {contactMatchTab === 'contactList' && (
              <>
                {contactListParseError && (
                  <Alert severity="error" onClose={() => setContactListParseError(null)} sx={{ mb: 2 }}>
                    {contactListParseError}
                  </Alert>
                )}
                <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => setContactListUploadOpen(true)}>
                      Upload contact list
                    </Button>
                    <Button
                      variant="contained"
                      color="primary"
                      disabled={crmCompaniesList.length === 0 || contactListData.length === 0 || !contactListCompanyKey || contactListUpdating}
                      startIcon={contactListUpdating ? <CircularProgress size={18} color="inherit" /> : undefined}
                      onClick={handleUpdateContactCompanies}
                    >
                      {contactListUpdating ? 'Updating…' : 'Update company names from CRM'}
                    </Button>
                    {contactListFileName && (
                      <Typography variant="body2" color="text.secondary">
                        {contactListFileName} — {contactListData.length.toLocaleString()} rows
                      </Typography>
                    )}
                  </Box>
                  {contactListData.length > 0 && crmCompaniesList.length > 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Match each contact&apos;s company to the CRM list and replace with the CRM company name.
                    </Typography>
                  )}
                </Paper>
                {contactListData.length === 0 ? (
                  <Paper variant="outlined" sx={{ p: 4, borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="body1" color="text.secondary">
                      No contacts yet. Upload a CSV or Excel file with contacts (Name, Email, Company, etc.).
                    </Typography>
                  </Paper>
                ) : (
                  <ContactsTable
                    contacts={contactListData}
                    headers={contactListHeaders}
                    maxHeight={520}
                    companyColumnKey={contactListCompanyKey}
                    entityColumnKey={contactListEntityKey}
                  />
                )}
              </>
            )}
          </Box>
        )}

        {featureTab === 'contactSearch' && parseError && (
          <Alert severity="error" onClose={() => setParseError(null)} sx={{ mb: 2 }}>
            {parseError}
          </Alert>
        )}

        {featureTab === 'contactSearch' && !hasFile && (
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
              >
                Upload file
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
                Demo file: <code style={{ fontSize: '0.85em' }}>/demo-contacts-25k.csv</code> in the app&apos;s public folder (25,000 contacts, 25 companies).
              </Typography>
            </Paper>
          </Box>
        )}

        {featureTab === 'contactSearch' && hasFile && (
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
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={exactMatch}
                      onChange={(e) => setExactMatch(e.target.checked)}
                      size="small"
                    />
                  }
                  label="Exact match"
                  sx={{ ml: 0.5 }}
                />
                <Button
                  variant="contained"
                  startIcon={aiSearchLoading ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
                  onClick={handleAiSearch}
                  disabled={!effectiveCompany || !companyColumnKey || aiSearchLoading}
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

            <Tabs value={activeTab} onChange={(_, v: TabValue) => setActiveTab(v)} sx={{ mb: 2, minHeight: 48 }} textColor="primary" indicatorColor="primary">
              <Tab label="Contacts" value="contacts" />
              <Tab label="AI Results" value="aiResults" />
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Typography variant="subtitle2" color="primary">
                        {aiResultsContacts.length.toLocaleString()} contacts matching your search.
                      </Typography>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={handleExportResults}
                      >
                        Export results
                      </Button>
                    </Box>
                    {exportError && (
                      <Alert severity="error" onClose={() => setExportError(null)} sx={{ mb: 2 }}>
                        {exportError}
                      </Alert>
                    )}
                    {toolCalls != null && toolCalls.length > 0 && (
                      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                        <Typography variant="subtitle2" color="primary" gutterBottom>
                          Agent looked up
                        </Typography>
                        <List dense disablePadding>
                          {toolCalls.map((tc, i) => (
                            <ListItem key={i} sx={{ py: 0.25, display: 'block' }}>
                              <Typography variant="body2" component="span">
                                Searched: &quot;{tc.query ?? '—'}&quot;
                                {tc.summary ? ` — ${tc.summary}` : ''}
                              </Typography>
                            </ListItem>
                          ))}
                        </List>
                      </Paper>
                    )}
                    {reasoningSteps != null && reasoningSteps.length > 0 && (
                      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                        <Typography variant="subtitle2" color="primary" gutterBottom>
                          How the agent matched
                        </Typography>
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
                      </Paper>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                      <TextField
                        size="small"
                        label="Refine results"
                        placeholder="e.g. Also include bottling plants or Exclude subsidiaries"
                        value={refineInput}
                        onChange={(e) => setRefineInput(e.target.value)}
                        disabled={refineLoading}
                        sx={{ minWidth: 280, flex: 1 }}
                      />
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleRefine}
                        disabled={!refineInput.trim() || refineLoading}
                        startIcon={refineLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
                      >
                        Refine
                      </Button>
                    </Box>
                    <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                      <Typography variant="subtitle2" color="primary" gutterBottom>
                        List entries matched to parent company
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {matchingCompanyNames.length} string(s) from your upload that the LLM matched to the parent company. These are not company names—they are the bad data (variants, misspellings, brand names as entered) that will be normalized to the parent.
                      </Typography>
                      <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                        {matchingCompanyNames.sort((a, b) => a.localeCompare(b)).map((name) => (
                          <ListItem key={name} sx={{ py: 0 }}>
                            <ListItemText primary={name} primaryTypographyProps={{ variant: 'body2' }} />
                          </ListItem>
                        ))}
                      </List>
                    </Paper>
                    <Box sx={{ mt: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                        <Typography variant="subtitle2" color="primary">
                          Results table — {aiResultsContactsWithDescription.length.toLocaleString()} row{aiResultsContactsWithDescription.length !== 1 ? 's' : ''}
                        </Typography>
                      </Box>
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
  const [slideIndex, setSlideIndex] = useState<number | 'demo'>(0)
  const [exiting, setExiting] = useState(false)
  const theme = useMemo(() => getAppTheme(mode), [mode])
  const onToggleMode = useCallback(() => {
    const next = mode === 'light' ? 'dark' : 'light'
    setMode(next)
    localStorage.setItem('themeMode', next)
  }, [mode])

  const slideTransitionRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (slideTransitionRef.current) clearTimeout(slideTransitionRef.current)
  }, [])

  const onSlideNext = useCallback(() => {
    if (slideIndex === 'demo') return
    if (slideTransitionRef.current) clearTimeout(slideTransitionRef.current)
    setExiting(true)
    const duration = 280
    slideTransitionRef.current = setTimeout(() => {
      slideTransitionRef.current = null
      setSlideIndex((prev) => {
        if (prev === 'demo') return prev
        if (typeof prev === 'number' && prev >= SLIDES.length - 1) return 'demo'
        return typeof prev === 'number' ? prev + 1 : 0
      })
      setExiting(false)
    }, duration)
  }, [slideIndex])

  const showSlides = slideIndex !== 'demo' && SLIDES.length > 0 && SLIDES[slideIndex] != null
  const showDemo = slideIndex === 'demo' || SLIDES.length === 0

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          opacity: exiting ? 0 : 1,
          transition: 'opacity 0.28s ease',
          width: '100%',
          minHeight: '100vh',
        }}
      >
        {showSlides && (
          <DemoSlide
            html={SLIDES[slideIndex as number]}
            isLastSlide={slideIndex === SLIDES.length - 1}
            onNext={onSlideNext}
          />
        )}
        {showDemo && <AppContent mode={mode} onToggleMode={onToggleMode} />}
      </Box>
    </ThemeProvider>
  )
}
