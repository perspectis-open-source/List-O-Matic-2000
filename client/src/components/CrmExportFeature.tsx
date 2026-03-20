/**
 * @file CrmExportFeature.tsx
 * @description Self-contained CRM export feature wrapper. Handles feature detection,
 * button rendering, and dialog state. App.tsx renders this one component and has
 * zero CRM knowledge. Renders null when CRM is disabled.
 * @module List-O-Matic-2000/client
 */
import { useState, useEffect } from 'react'
import { Button } from '@mui/material'
import type { ContactRow } from '../utils/parseFile'
import { fetchCrmEnabled } from '../api/crmExport'
import { CrmExportDialog } from './CrmExportDialog'

interface CrmExportFeatureProps {
  contacts: ContactRow[]
  headers: string[]
}

export function CrmExportFeature({ contacts, headers }: CrmExportFeatureProps) {
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

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        onClick={() => setDialogOpen(true)}
        data-testid="crm-export-trigger"
      >
        Export to CRM
      </Button>
      <CrmExportDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        contacts={contacts}
        headers={headers}
      />
    </>
  )
}
