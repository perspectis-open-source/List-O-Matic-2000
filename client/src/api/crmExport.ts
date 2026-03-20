/**
 * @file crmExport.ts
 * @description Client API for CRM export: types, feature detection, and export function.
 * All CRM client API logic is isolated in this file.
 * @module List-O-Matic-2000/client
 */
import type { ContactRow } from '../utils/parseFile'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export type CrmFieldMapping = Record<string, string>

export type CrmExportRequest = {
  contacts: ContactRow[]
  fieldMapping: CrmFieldMapping
  upsertEndpoint?: string
}

export type CrmExportResponse = {
  totalSent: number
  created: number
  updated: number
  failed: number
  errors: Array<{ email: string; error: string }>
}

/**
 * Check whether the CRM connector is enabled on the server.
 * Fail-closed: returns false on any error so the UI never shows
 * a CRM button it can't back up.
 */
export async function fetchCrmEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/crm/status`)
    if (!res.ok) return false
    const data = await res.json()
    return data?.enabled === true
  } catch {
    return false
  }
}

/**
 * Export contacts to the CRM via the server-side connector.
 * Throws on HTTP errors with the server's error message.
 */
export async function postCrmExport(request: CrmExportRequest): Promise<CrmExportResponse> {
  const res = await fetch(`${API_BASE}/api/crm/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<CrmExportResponse>
}
