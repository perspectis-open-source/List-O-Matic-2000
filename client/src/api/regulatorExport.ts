/**
 * @file regulatorExport.ts
 * @description POST /api/export/basic-json — standalone-safe JSON export (no governance JSON-LD).
 */

export type BasicExportRecord = Record<string, unknown>

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const SECRET = import.meta.env.VITE_REGULATOR_EXPORT_SECRET ?? ''

export type RegulatorExportManifest = {
  version: 1
  generatedAt: string
  artifacts: { path: string; sha256: string }[]
}

export type RegulatorExportResponse = {
  exportJson: unknown
  manifest: RegulatorExportManifest
}

export async function postRegulatorExport(record: BasicExportRecord): Promise<RegulatorExportResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (SECRET) headers['x-regulator-export-secret'] = SECRET
  const res = await fetch(`${API_BASE}/api/export/basic-json`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ evidenceRecord: record }),
  })
  const text = await res.text()
  let body: unknown
  try {
    body = JSON.parse(text) as unknown
  } catch {
    body = { error: text }
  }
  if (!res.ok) {
    const err = (body as { error?: string })?.error ?? res.statusText
    throw new Error(`${res.status}: ${err}`)
  }
  return body as RegulatorExportResponse
}
