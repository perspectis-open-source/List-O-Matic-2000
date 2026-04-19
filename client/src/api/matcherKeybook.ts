/**
 * @file matcherKeybook.ts
 * @description GET /api/matcher-keybook — persisted matcher JSONL rows (no PII beyond company strings).
 */
const API_BASE = import.meta.env.VITE_API_URL ?? ''

export type MatcherKeybookCompanyRow = { name: string; parentCompany: string }

export type MatcherKeybookContactRow = { raw: string; parentCompany: string }

export type MatcherKeybookContactMatchRow = {
  contactCompany: string
  matchedCompany: string
  parentCompany: string
}

export type MatcherKeybookSnapshot = {
  companyKey: MatcherKeybookCompanyRow[]
  contactCompanyKey: MatcherKeybookContactRow[]
  contactCompanyMatch: MatcherKeybookContactMatchRow[]
}

export async function getMatcherKeybook(): Promise<MatcherKeybookSnapshot> {
  const res = await fetch(`${API_BASE}/api/matcher-keybook`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Matcher keybook request failed (${res.status})`)
  }
  return res.json() as Promise<MatcherKeybookSnapshot>
}
