/**
 * @file CrmExportFeature.tsx
 * @description Self-contained CRM export feature wrapper. Handles feature detection,
 * button rendering, and dialog state. App.tsx renders this one component and has
 * zero CRM knowledge. Renders null when CRM is disabled.
 * @module List-O-Matic-2000/client
 */
import { useState, useEffect } from 'react'
import { Button, Tooltip } from '@mui/material'
import type { ContactRow } from '../utils/parseFile'
import { fetchCrmEnabled } from '../api/crmExport'
import { CrmExportDialog } from './CrmExportDialog'

interface CrmExportFeatureProps {
  contacts: ContactRow[]
  headers: string[]
  /** Smaller trigger button for dense toolbars (e.g. normalizer results row). */
  compact?: boolean
}

const compactButtonSx = {
  py: 0.25,
  px: 0.75,
  minHeight: 28,
  fontSize: '0.7rem',
  lineHeight: 1.2,
  textTransform: 'none' as const,
}

export function CrmExportFeature({ contacts, headers, compact = false }: CrmExportFeatureProps) {
  const [crmEnabled, setCrmEnabled] = useState<boolean | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchCrmEnabled().then((enabled) => {
      if (!cancelled) setCrmEnabled(enabled)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (crmEnabled !== true) return null

  const triggerButton = (
    <Button
      variant="outlined"
      size="small"
      onClick={() => setDialogOpen(true)}
      data-testid="crm-export-trigger"
      sx={compact ? compactButtonSx : undefined}
    >
      {compact ? 'CRM' : 'Export to CRM'}
    </Button>
  )

  return (
    <>
      {compact ? <Tooltip title="Export to CRM">{triggerButton}</Tooltip> : triggerButton}
      <CrmExportDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        contacts={contacts}
        headers={headers}
      />
    </>
  )
}
