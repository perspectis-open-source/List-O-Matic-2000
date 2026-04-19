/**
 * @file matcherKeybookCoverage.ts
 * @description Coverage counts for matcher keybooks vs current imports (client-side).
 */
import type { MatcherKeybookSnapshot } from '../api/matcherKeybook'

export type MatcherKeybookCoverage = {
  companyKeyWithParent: number
  companyKeyTotal: number
  contactKeyWithParent: number
  contactKeyTotal: number
}

function nonEmpty(s: string): boolean {
  return String(s ?? '').trim().length > 0
}

/**
 * How many current canonical company Names and unique contact raws have a non-empty parent in the snapshot keybooks.
 */
export function computeMatcherKeybookCoverage(
  snapshot: MatcherKeybookSnapshot | null,
  canonicalNames: string[],
  uniqueContactRaws: string[],
): MatcherKeybookCoverage | null {
  if (!snapshot) return null
  const companyParentByName = new Map<string, string>()
  for (const r of snapshot.companyKey) {
    companyParentByName.set(String(r.name).trim(), String(r.parentCompany ?? '').trim())
  }
  let companyKeyWithParent = 0
  for (const n of canonicalNames) {
    const p = companyParentByName.get(String(n).trim()) ?? ''
    if (nonEmpty(p)) companyKeyWithParent++
  }

  const contactParentByRaw = new Map<string, string>()
  for (const r of snapshot.contactCompanyKey) {
    contactParentByRaw.set(String(r.raw).trim(), String(r.parentCompany ?? '').trim())
  }
  let contactKeyWithParent = 0
  for (const raw of uniqueContactRaws) {
    const p = contactParentByRaw.get(String(raw).trim()) ?? ''
    if (nonEmpty(p)) contactKeyWithParent++
  }

  return {
    companyKeyWithParent,
    companyKeyTotal: canonicalNames.length,
    contactKeyWithParent,
    contactKeyTotal: uniqueContactRaws.length,
  }
}
