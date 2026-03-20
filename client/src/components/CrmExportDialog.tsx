/**
 * @file CrmExportDialog.tsx
 * @description CRM export dialog: field mapping UI, validation, privacy disclaimer,
 * progress indicator, result summary, and downloadable failure report.
 * All CRM UI logic is isolated in this file.
 * @module List-O-Matic-2000/client
 */
import { useState, useMemo, useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  Box,
  Typography,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import DownloadIcon from '@mui/icons-material/Download'
import type { ContactRow } from '../utils/parseFile'
import { downloadCsv } from '../utils/exportCsv'
import { postCrmExport, type CrmExportResponse } from '../api/crmExport'

type ExportState = 'idle' | 'exporting' | 'success' | 'error'

const DEFAULT_MAPPINGS: Record<string, string> = {
  email: 'email',
  name: 'full_name',
  'full name': 'full_name',
  'first name': 'first_name',
  'last name': 'last_name',
  company: 'company_name',
  organization: 'company_name',
  phone: 'phone',
  telephone: 'phone',
  title: 'title',
  'job title': 'title',
}

function getDefaultMapping(header: string): string {
  return DEFAULT_MAPPINGS[header.toLowerCase()] ?? ''
}

interface CrmExportDialogProps {
  open: boolean
  onClose: () => void
  contacts: ContactRow[]
  headers: string[]
}

export function CrmExportDialog({ open, onClose, contacts, headers }: CrmExportDialogProps) {
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const h of headers) {
      initial[h] = getDefaultMapping(h)
    }
    return initial
  })
  const [exportState, setExportState] = useState<ExportState>('idle')
  const [result, setResult] = useState<CrmExportResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const hasEmailMapping = useMemo(
    () => Object.values(fieldMapping).some((v) => v.trim() === 'email'),
    [fieldMapping]
  )

  const activeMappings = useMemo(
    () => Object.fromEntries(Object.entries(fieldMapping).filter(([, v]) => v.trim() !== '')),
    [fieldMapping]
  )

  const handleFieldChange = useCallback((header: string, value: string) => {
    setFieldMapping((prev) => ({ ...prev, [header]: value }))
  }, [])

  const handleExport = useCallback(async () => {
    if (!hasEmailMapping) return
    setExportState('exporting')
    setResult(null)
    setErrorMessage(null)

    try {
      const response = await postCrmExport({
        contacts,
        fieldMapping: activeMappings,
      })
      setResult(response)
      setExportState('success')
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Export failed')
      setExportState('error')
    }
  }, [contacts, activeMappings, hasEmailMapping])

  const handleDownloadFailures = useCallback(() => {
    if (!result || result.errors.length === 0) return
    const rows = result.errors.map((e) => ({ Email: e.email, Error: e.error }))
    downloadCsv(rows, ['Email', 'Error'], `crm-export-failures-${new Date().toISOString().slice(0, 10)}.csv`)
  }, [result])

  const handleClose = useCallback(() => {
    if (exportState !== 'exporting') {
      setExportState('idle')
      setResult(null)
      setErrorMessage(null)
      onClose()
    }
  }, [exportState, onClose])

  if (!open) return null

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      data-testid="crm-export-dialog"
    >
      <DialogTitle>Export to CRM</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }} data-testid="crm-export-disclaimer">
          Contact data will be sent to your configured CRM. Ensure you have appropriate consent to
          export this data to a third-party service.
        </Alert>

        {exportState === 'exporting' && (
          <Box sx={{ mb: 2 }} data-testid="crm-export-progress">
            <LinearProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Exporting {contacts.length.toLocaleString()} contacts... This may take a moment for
              large lists.
            </Typography>
          </Box>
        )}

        {exportState === 'success' && result && (
          <Alert severity={result.failed > 0 ? 'warning' : 'success'} sx={{ mb: 2 }} data-testid="crm-export-summary">
            Export complete: {result.created} created, {result.updated} updated, {result.failed}{' '}
            failed out of {result.totalSent} total.
          </Alert>
        )}

        {exportState === 'error' && errorMessage && (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="crm-export-error">
            {errorMessage}
          </Alert>
        )}

        {result && result.errors.length > 0 && (
          <Accordion
            defaultExpanded={false}
            sx={{ mb: 2, borderRadius: 2, '&:before': { display: 'none' }, border: 1, borderColor: 'divider' }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2" color="error">
                {result.errors.length} failed record{result.errors.length !== 1 ? 's' : ''}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <List dense sx={{ maxHeight: 200, overflowY: 'auto' }}>
                {result.errors.map((err, i) => (
                  <ListItem key={i} sx={{ py: 0.25 }}>
                    <ListItemText
                      primary={err.email}
                      secondary={err.error}
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </List>
              <Button
                size="small"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadFailures}
                sx={{ mt: 1 }}
                data-testid="crm-export-download-failures"
              >
                Download failed records
              </Button>
            </AccordionDetails>
          </Accordion>
        )}

        {exportState !== 'exporting' && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Field Mapping
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Map your CSV headers to CRM field names. Leave blank to skip a field.
              At least one field must be mapped to &quot;email&quot; (the upsert key).
            </Typography>
            {!hasEmailMapping && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                No field is mapped to &quot;email&quot;. You must map one field to &quot;email&quot; to export.
              </Alert>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {headers.map((header) => (
                <TextField
                  key={header}
                  label={header}
                  placeholder="CRM field name (e.g. email, full_name)"
                  value={fieldMapping[header] ?? ''}
                  onChange={(e) => handleFieldChange(header, e.target.value)}
                  size="small"
                  fullWidth
                  disabled={exportState === 'exporting'}
                  slotProps={{
                    inputLabel: { shrink: true },
                  }}
                />
              ))}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={exportState === 'exporting'}>
          Close
        </Button>
        <Button
          variant="contained"
          onClick={handleExport}
          disabled={exportState === 'exporting' || !hasEmailMapping}
          data-testid="crm-export-button"
        >
          {exportState === 'exporting' ? 'Exporting...' : 'Export to CRM'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
