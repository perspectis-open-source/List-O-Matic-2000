import { useState, useCallback, useMemo } from 'react'
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
} from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import SearchIcon from '@mui/icons-material/Search'
import DownloadIcon from '@mui/icons-material/Download'
import { getAppTheme } from './theme'
import { parseContactFile, type ContactRow } from './utils/parseFile'
import { downloadCsv, sanitizeFilenameSegment } from './utils/exportCsv'
import { getDescriptionForCompanyName } from './utils/companyDescriptions'
import { UploadDropZone } from './components/UploadDropZone'
import { ContactsTable } from './components/ContactsTable'
import { CompanySelect } from './components/CompanySelect'
import { postChat } from './api/chat'

type TabValue = 'contacts' | 'aiResults'

function AppContent({ mode, onToggleMode }: { mode: 'light' | 'dark'; onToggleMode: () => void }) {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [companyColumnKey, setCompanyColumnKey] = useState<string | null>(null)
  const [entityColumnKey, setEntityColumnKey] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null)
  const [matchingCompanyNames, setMatchingCompanyNames] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<TabValue>('contacts')
  const [aiSearchLoading, setAiSearchLoading] = useState(false)
  const [aiSearchError, setAiSearchError] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const handleFileAccepted = useCallback(async (file: File) => {
    setParseError(null)
    setSelectedCompany(null)
    setMatchingCompanyNames([])
    setAiSearchError(null)
    setExportError(null)
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
    const set = new Set(matchingCompanyNames)
    return contacts.filter((row) => set.has(String((row[companyColumnKey] ?? '').trim())))
  }, [contacts, companyColumnKey, matchingCompanyNames])

  const { aiResultsHeaders, aiResultsContactsWithDescription } = useMemo(() => {
    const extendedHeaders = [...headers, 'Description']
    const withDescription: ContactRow[] = aiResultsContacts.map((row) => ({
      ...row,
      Description: getDescriptionForCompanyName(companyColumnKey ? row[companyColumnKey] : undefined),
    }))
    return { aiResultsHeaders: extendedHeaders, aiResultsContactsWithDescription: withDescription }
  }, [headers, aiResultsContacts, companyColumnKey])

  const emailColumnKey = useMemo(() => {
    const e = headers.find((h) => h.toLowerCase() === 'email')
    return e ?? null
  }, [headers])

  const { namesByEmailDomain, totalByEmailDomain, emailDomain } = useMemo(() => {
    if (!companyColumnKey || !emailColumnKey || aiResultsContacts.length === 0) {
      return { namesByEmailDomain: [], totalByEmailDomain: 0, emailDomain: null }
    }
    const firstEmail = aiResultsContacts[0][emailColumnKey]
    if (!firstEmail || !firstEmail.includes('@')) {
      return { namesByEmailDomain: [], totalByEmailDomain: 0, emailDomain: null }
    }
    const domain = firstEmail.split('@')[1]?.trim()
    if (!domain) return { namesByEmailDomain: [], totalByEmailDomain: 0, emailDomain: null }
    const withDomain = contacts.filter((row) => (row[emailColumnKey] ?? '').split('@')[1]?.trim() === domain)
    const set = new Set<string>()
    for (const row of withDomain) {
      const v = row[companyColumnKey]
      if (v != null && String(v).trim() !== '') set.add(String(v).trim())
    }
    return {
      namesByEmailDomain: Array.from(set).sort((a, b) => a.localeCompare(b)),
      totalByEmailDomain: withDomain.length,
      emailDomain: domain,
    }
  }, [contacts, companyColumnKey, emailColumnKey, aiResultsContacts])

  const handleAiSearch = useCallback(async () => {
    if (!selectedCompany || !companyColumnKey || aiSearchLoading) return
    setAiSearchError(null)
    setAiSearchLoading(true)
    try {
      const message = `Find everyone that works at ${selectedCompany}`
      const res = await postChat([{ role: 'user', content: message }], uniqueCompanyNames)
      setMatchingCompanyNames(res.matchingCompanyNames ?? [])
      setActiveTab('aiResults')
    } catch (e) {
      setAiSearchError(e instanceof Error ? e.message : 'Request failed')
      setMatchingCompanyNames([])
    } finally {
      setAiSearchLoading(false)
    }
  }, [selectedCompany, companyColumnKey, uniqueCompanyNames, aiSearchLoading])

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
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ px: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Marketing Demo — Contact List + AI
          </Typography>
          <IconButton color="inherit" onClick={onToggleMode} aria-label="Toggle theme">
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
          <Button
            color="inherit"
            startIcon={<UploadFileIcon />}
            onClick={() => setUploadOpen(true)}
          >
            Upload file
          </Button>
        </Toolbar>
      </AppBar>

      <UploadDropZone
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onFileAccepted={handleFileAccepted}
      />

      <Container maxWidth="xl" sx={{ flex: 1, py: 2 }}>
        {parseError && (
          <Alert severity="error" onClose={() => setParseError(null)} sx={{ mb: 2 }}>
            {parseError}
          </Alert>
        )}

        {!hasFile && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary" gutterBottom>
              Upload a CSV or Excel file with contacts (Name, Email, Company, etc.).
            </Typography>
            <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => setUploadOpen(true)}>
              Upload file
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Demo file: <code>/demo-contacts-25k.csv</code> in the app&apos;s public folder (25,000 contacts, 25 companies).
            </Typography>
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
                  disabled={!companyColumnKey}
                />
                <Button
                  variant="contained"
                  startIcon={aiSearchLoading ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
                  onClick={handleAiSearch}
                  disabled={!selectedCompany || !companyColumnKey || aiSearchLoading}
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
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2 }}>
                      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                        <Typography variant="subtitle2" color="primary" gutterBottom>
                          Companies returned in AI search
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {matchingCompanyNames.length} name(s) the LLM returned as variants.
                        </Typography>
                        <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                          {matchingCompanyNames.sort((a, b) => a.localeCompare(b)).map((name) => (
                            <ListItem key={name} sx={{ py: 0 }}>
                              <ListItemText primary={name} primaryTypographyProps={{ variant: 'body2' }} />
                            </ListItem>
                          ))}
                        </List>
                      </Paper>
                      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                        <Typography variant="subtitle2" color="primary" gutterBottom>
                          Names associated with selected company (by email domain)
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {emailDomain
                            ? `${totalByEmailDomain.toLocaleString()} contacts with domain @${emailDomain}; ${namesByEmailDomain.length} unique company name(s).`
                            : 'Email column not found or no domain.'}
                        </Typography>
                        {emailDomain && (
                          <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                            {namesByEmailDomain.map((name) => (
                              <ListItem key={name} sx={{ py: 0 }}>
                                <ListItemText primary={name} primaryTypographyProps={{ variant: 'body2' }} />
                              </ListItem>
                            ))}
                          </List>
                        )}
                      </Paper>
                    </Box>
                    <Box sx={{ mt: 1 }}>
                    <ContactsTable
                      contacts={aiResultsContactsWithDescription}
                      headers={aiResultsHeaders}
                      maxHeight={420}
                      companyColumnKey={companyColumnKey}
                      entityColumnKey={entityColumnKey}
                    />
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
      <AppContent mode={mode} onToggleMode={onToggleMode} />
    </ThemeProvider>
  )
}
