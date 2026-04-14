/**
 * @file UploadDropZone.tsx
 * @description Guided import dialog: pick file, wait for parse, then Next / Skip / Cancel.
 * @module List-O-Matic-2000/client
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'

const ACCEPT = {
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
}

export type UploadImportKind = 'contacts' | 'companies'

export type ImportParseResult = { fileName: string; rowCount: number }

type Props = {
  open: boolean
  onClose: () => void
  /** First file type to request when the dialog opens. */
  entryKind: UploadImportKind
  hasContacts: boolean
  onImportContacts: (file: File) => Promise<ImportParseResult>
  onImportCompanies: (file: File) => Promise<ImportParseResult>
}

const TITLES: Record<UploadImportKind, string> = {
  contacts: 'Import contacts',
  companies: 'Import companies',
}

type Phase = 'pick' | 'parsing' | 'afterSuccess'

export function ImportWorkflowDialog({
  open,
  onClose,
  entryKind,
  hasContacts,
  onImportContacts,
  onImportCompanies,
}: Props) {
  const [phase, setPhase] = useState<Phase>('pick')
  const [activeKind, setActiveKind] = useState<UploadImportKind>(entryKind)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<{ fileName: string; rowCount: number; kind: UploadImportKind } | null>(
    null
  )
  const parseGenRef = useRef(0)

  useEffect(() => {
    if (!open) return
    setPhase('pick')
    setActiveKind(entryKind)
    setError(null)
    setSummary(null)
    parseGenRef.current += 1
  }, [open, entryKind])

  const runImport = useCallback(
    async (file: File) => {
      const gen = ++parseGenRef.current
      setPhase('parsing')
      setError(null)
      try {
        const fn = activeKind === 'contacts' ? onImportContacts : onImportCompanies
        const result = await fn(file)
        if (gen !== parseGenRef.current) return
        setSummary({ fileName: result.fileName, rowCount: result.rowCount, kind: activeKind })
        setPhase('afterSuccess')
      } catch (e) {
        if (gen !== parseGenRef.current) return
        setError(e instanceof Error ? e.message : 'Failed to parse file')
        setPhase('pick')
      }
    },
    [activeKind, onImportContacts, onImportCompanies]
  )

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (file && phase === 'pick') void runImport(file)
    },
    [phase, runImport]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxFiles: 1,
    noClick: phase !== 'pick',
    noKeyboard: phase !== 'pick',
    disabled: phase !== 'pick',
  })

  const handleDialogClose = useCallback(
    (_e: object, _reason: 'backdropClick' | 'escapeKeyDown') => {
      if (phase === 'parsing') return
      onClose()
    },
    [phase, onClose]
  )

  const handleCancel = useCallback(() => {
    if (phase === 'parsing') return
    onClose()
  }, [phase, onClose])

  const handleSkip = useCallback(() => {
    onClose()
  }, [onClose])

  const handleNext = useCallback(() => {
    if (!summary) return
    if (summary.kind === 'contacts') {
      setActiveKind('companies')
      setSummary(null)
      setPhase('pick')
      setError(null)
      return
    }
    setActiveKind('contacts')
    setSummary(null)
    setPhase('pick')
    setError(null)
  }, [summary])

  const companiesDoneOnly = summary?.kind === 'companies' && hasContacts && phase === 'afterSuccess'

  return (
    <Dialog open={open} onClose={handleDialogClose} maxWidth="sm" fullWidth>
      <DialogTitle>{TITLES[activeKind]}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {phase === 'afterSuccess' && summary && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Loaded {summary.rowCount.toLocaleString()} row{summary.rowCount !== 1 ? 's' : ''} from{' '}
            <strong>{summary.fileName}</strong>.
            {summary.kind === 'contacts' &&
              ' You can add a companies file next, or skip for now. Matcher works best with both.'}
            {summary.kind === 'companies' && !hasContacts && ' Import contacts next, or skip and add them later.'}
          </Alert>
        )}
        {phase === 'parsing' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2, justifyContent: 'center' }}>
            <CircularProgress size={28} />
            <Typography color="text.secondary">Reading file…</Typography>
          </Box>
        )}
        {phase === 'pick' && (
          <Box
            {...getRootProps()}
            data-testid="import-workflow-dropzone"
            sx={{
              border: '2px dashed',
              borderColor: isDragActive ? 'primary.main' : 'divider',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: isDragActive ? 'action.hover' : 'background.default',
            }}
          >
            <input {...getInputProps()} data-testid="import-workflow-file-input" />
            <Typography color="text.secondary">
              {isDragActive
                ? 'Drop CSV or Excel here'
                : 'Drag and drop a CSV or .xlsx file here, or click to choose'}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, pt: 1, display: 'block' }}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            alignItems: 'center',
            width: '100%',
          }}
        >
          <Button
            onClick={handleCancel}
            disabled={phase === 'parsing'}
            data-testid="import-workflow-cancel"
            sx={{ mr: 'auto' }}
          >
            Cancel
          </Button>
          {phase === 'afterSuccess' && summary && (
            <>
              {companiesDoneOnly ? (
                <Button variant="contained" onClick={handleSkip} data-testid="import-workflow-done">
                  Done
                </Button>
              ) : (
                <>
                  <Button
                    variant="outlined"
                    onClick={handleSkip}
                    data-testid="import-workflow-skip"
                    title={
                      summary.kind === 'contacts'
                        ? 'Close without importing companies'
                        : 'Close without importing contacts'
                    }
                  >
                    Skip
                  </Button>
                  {summary.kind === 'contacts' && (
                    <Button variant="contained" onClick={handleNext} data-testid="import-workflow-next">
                      Add companies
                    </Button>
                  )}
                  {summary.kind === 'companies' && !hasContacts && (
                    <Button variant="contained" onClick={handleNext} data-testid="import-workflow-next">
                      Add contacts
                    </Button>
                  )}
                </>
              )}
            </>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  )
}

