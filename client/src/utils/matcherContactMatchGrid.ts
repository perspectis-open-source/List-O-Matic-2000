/**
 * @file matcherContactMatchGrid.ts
 * @description Enrich persisted matcher keybook match rows with CRM company from the companies import.
 */
import type { MatcherKeybookContactMatchRow } from '../api/matcherKeybook'
import type { CompanyRow } from './parseFile'

export type MatchKeyGridRow = MatcherKeybookContactMatchRow & {
  /** Canonical label from companies file for the matched Name row (optional CRM-specific column when present). */
  crmCompany: string
}

const CRM_LABEL_HEADERS = ['CRM Company', 'CRM company', 'Canonical Name', 'canonical name'] as const

function pickCrmLabelFromCompanyRow(row: CompanyRow): string {
  for (const h of CRM_LABEL_HEADERS) {
    if (h in row) {
      const v = String(row[h] ?? '').trim()
      if (v) return v
    }
  }
  return String(row['Name'] ?? '').trim()
}

/** First-seen row per trimmed Name (case-insensitive key). */
function companyRowByMatchedName(companies: CompanyRow[]): Map<string, CompanyRow> {
  const m = new Map<string, CompanyRow>()
  for (const r of companies) {
    const name = String(r['Name'] ?? '').trim()
    if (!name) continue
    const k = name.toLowerCase()
    if (!m.has(k)) m.set(k, r)
  }
  return m
}

/**
 * Adds `crmCompany`: firms' master list label for the matched companies-file row (Name casing, or CRM Company column when set).
 */
export function buildMatchKeyGridRows(
  rows: MatcherKeybookContactMatchRow[],
  companies: CompanyRow[],
): MatchKeyGridRow[] {
  const byMatchedLower = companyRowByMatchedName(companies)
  return rows.map((row) => {
    const matched = String(row.matchedCompany ?? '').trim()
    if (!matched) return { ...row, crmCompany: '' }
    const companyRow = byMatchedLower.get(matched.toLowerCase())
    const crmCompany = companyRow ? pickCrmLabelFromCompanyRow(companyRow) : matched
    return { ...row, crmCompany }
  })
}
