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

export type MatcherKeybookClearSelection = {
  companyKey: boolean
  contactCompanyKey: boolean
  contactCompanyMatch: boolean
}

/** @deprecated Use `MatcherKeybookClearSelection` */
export type MatcherParentKeybookClearSelection = MatcherKeybookClearSelection

export async function getMatcherKeybook(): Promise<MatcherKeybookSnapshot> {
  const res = await fetch(`${API_BASE}/api/matcher-keybook`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Matcher keybook request failed (${res.status})`)
  }
  return res.json() as Promise<MatcherKeybookSnapshot>
}

/** Clears selected matcher JSONL files on the server (`company-key`, `contact-company-key`, and/or `contact-company-match`). */
export async function clearMatcherParentKeybooks(
  selection: MatcherKeybookClearSelection,
): Promise<{ ok: boolean; cleared: MatcherKeybookClearSelection }> {
  const res = await fetch(`${API_BASE}/api/matcher-keybook/clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(selection),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = text || `Matcher keybook clear failed (${res.status})`
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j.error) msg = j.error
    } catch {
      /* keep msg */
    }
    throw new Error(msg)
  }
  return res.json() as Promise<{ ok: boolean; cleared: MatcherKeybookClearSelection }>
}
