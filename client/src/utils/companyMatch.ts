/**
 * @file companyMatch.ts
 * @description Deterministic company-name matching: normalize, blocking index, Jaro–Winkler scoring, tiering.
 */
import type { CompanyRow, ContactRow } from './parseFile'
import {
  MATCH_BLOCKING_EXPAND_THRESHOLD,
  MATCH_MAX_CANDIDATES_FULL_SCAN,
  MATCH_SCORE_GAP,
  MATCH_SCORE_HIGH,
  MATCH_SCORE_LOW,
  MATCH_LLM_TOP_K,
  MATCHED_COMPANY_HEADER,
} from '../constants/companyMatch'

export type DeterministicTier = 'auto' | 'ambiguous' | 'needs_llm'

export type DeterministicMatchRow = {
  raw: string
  tier: DeterministicTier
  /** Best suggestion when tier is auto; leading candidate otherwise */
  best: string | null
  bestScore: number
  /** Top scored candidates for review / LLM (canonical Name strings) */
  topCandidates: { name: string; score: number }[]
}

/** Jaro similarity (0–1). */
export function jaro(a: string, b: string): number {
  if (a === b) return 1
  if (!a.length || !b.length) return 0
  const matchWindow = Math.floor(Math.max(a.length, b.length) / 2) - 1
  if (matchWindow < 0) return 0
  const aMatches = new Array(a.length).fill(false)
  const bMatches = new Array(b.length).fill(false)
  let matches = 0
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow)
    const end = Math.min(i + matchWindow + 1, b.length)
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue
      aMatches[i] = true
      bMatches[j] = true
      matches++
      break
    }
  }
  if (matches === 0) return 0
  let t = 0
  let k = 0
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue
    while (!bMatches[k]) k++
    if (a[i] !== b[k]) t++
    k++
  }
  t /= 2
  return (matches / a.length + matches / b.length + (matches - t) / matches) / 3
}

/** Jaro–Winkler similarity (0–1), prefix boost. */
export function jaroWinkler(a: string, b: string, p = 0.1): number {
  const j = jaro(a, b)
  if (j < 0.7) return j
  let prefix = 0
  const maxP = 4
  for (let i = 0; i < Math.min(maxP, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++
    else break
  }
  return j + prefix * p * (1 - j)
}

export function normalizeForMatch(s: string): string {
  const t = s.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')
  return t
}

/**
 * Trailing legal / entity suffixes (longer first). Keep aligned with server `LEGAL_SUFFIXES` in index.js.
 */
const LEGAL_SUFFIXES_STRIP_ORDER = [
  'Inc.',
  'Inc',
  'Corp.',
  'Corp',
  'Ltd.',
  'Ltd',
  'Co.',
  'Co',
  'LLC',
  'Limited',
  'Computer',
] as const

/**
 * Strip trailing ` {suffix}` segments from a normalized (lowercase) match string; repeats until stable.
 */
export function stripTrailingLegalSuffixForMatch(norm: string): string {
  let s = norm.trim()
  let changed = true
  while (changed) {
    changed = false
    for (const suffix of LEGAL_SUFFIXES_STRIP_ORDER) {
      const tail = ' ' + suffix.toLowerCase()
      if (s.endsWith(tail)) {
        s = s.slice(0, -tail.length).trimEnd()
        changed = true
        break
      }
    }
  }
  return s
}

function blockingKey2(norm: string): string {
  const alnum = norm.replace(/[^a-z0-9]/g, '')
  if (alnum.length >= 2) return alnum.slice(0, 2)
  if (alnum.length === 1) return alnum + '_'
  return '__'
}

/** Tokens that should not drive nickname→brand matching (legal boilerplate / sector words). */
const GENERIC_COMPANY_TOKENS = new Set([
  'company',
  'companies',
  'inc',
  'incorporated',
  'llc',
  'llp',
  'ltd',
  'limited',
  'corp',
  'corporation',
  'plc',
  'lp',
  'group',
  'holdings',
  'holding',
  'partners',
  'enterprises',
  'enterprise',
  'international',
  'intl',
  'global',
  'usa',
  'us',
  'associates',
  'association',
  'services',
  'service',
  'solutions',
  'systems',
  'capital',
  'management',
  'technologies',
  'technology',
  'industries',
  'products',
])

/** Token-level score for raw vs one word of a canonical name (used for nicknames like "Coke" vs "coca"). */
function tokenMatchScore(rawNorm: string, rawAlLen: number, tok: string): number {
  if (tok.length < 3) return 0
  if (GENERIC_COMPANY_TOKENS.has(tok)) return 0
  const jw = jaroWinkler(rawNorm, tok)
  if (rawAlLen >= 3 && tok.length > rawAlLen) {
    const excess = tok.length - rawAlLen
    const lenFactor = Math.max(0.55, 1 - 0.11 * excess)
    return jw * lenFactor
  }
  return jw
}

/** Dedupe canonical company names from import (trim, preserve first-seen casing). */
export function canonicalNamesFromCompanies(companies: CompanyRow[]): string[] {
  const lowerSeen = new Set<string>()
  const out: string[] = []
  for (const row of companies) {
    const n = row['Name']
    if (n == null) continue
    const t = String(n).trim()
    if (!t) continue
    const low = t.toLowerCase()
    if (lowerSeen.has(low)) continue
    lowerSeen.add(low)
    out.push(t)
  }
  return out
}

export function buildBlockingIndex(canonicalNames: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const name of canonicalNames) {
    const k = blockingKey2(normalizeForMatch(name))
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(name)
  }
  return map
}

function collectCandidates(
  rawNorm: string,
  canonicalNames: string[],
  index: Map<string, string[]>
): string[] {
  const k2 = blockingKey2(rawNorm)
  let pool = new Set<string>(index.get(k2) ?? [])
  if (pool.size < MATCH_BLOCKING_EXPAND_THRESHOLD && rawNorm.length > 0) {
    const ch = rawNorm.replace(/[^a-z0-9]/g, '').charAt(0)
    if (ch) {
      for (const name of canonicalNames) {
        const n = normalizeForMatch(name).replace(/[^a-z0-9]/g, '')
        if (n.startsWith(ch)) pool.add(name)
      }
    }
  }
  if (pool.size === 0) {
    return canonicalNames.length <= MATCH_MAX_CANDIDATES_FULL_SCAN
      ? [...canonicalNames]
      : canonicalNames.slice(0, MATCH_MAX_CANDIDATES_FULL_SCAN)
  }
  const arr = [...pool]
  if (arr.length > MATCH_MAX_CANDIDATES_FULL_SCAN) {
    // Keep the strongest matches, not the shortest names: long legal names (e.g. "Coca-Cola Company")
    // were being dropped while short unrelated names (e.g. "Cortiva") stayed in the pool.
    const ranked = arr.map((name) => ({ name, score: scorePair(rawNorm, name) }))
    ranked.sort((a, b) => b.score - a.score)
    return ranked.slice(0, MATCH_MAX_CANDIDATES_FULL_SCAN).map((x) => x.name)
  }
  return arr
}

/** Score using cores after stripping legal suffixes (e.g. apple ltd vs apple inc.). */
function coreScoreBonus(rawNorm: string, cNorm: string): number {
  const rawCore = stripTrailingLegalSuffixForMatch(rawNorm)
  const cCore = stripTrailingLegalSuffixForMatch(cNorm)
  if (!rawCore || !cCore) return 0
  if (rawCore === cCore) {
    if (rawCore.length >= 3) return 0.96
    return jaroWinkler(rawNorm, cNorm)
  }
  if (rawCore.includes(cCore) || cCore.includes(rawCore)) {
    return Math.min(1, jaroWinkler(rawCore, cCore) + 0.08)
  }
  return jaroWinkler(rawCore, cCore)
}

function scorePair(rawNorm: string, canonical: string): number {
  const cNorm = normalizeForMatch(canonical)
  if (rawNorm === cNorm) return 1
  let score: number
  if (rawNorm.includes(cNorm) || cNorm.includes(rawNorm)) {
    const base = jaroWinkler(rawNorm, cNorm)
    score = Math.min(1, base + 0.08)
  } else {
    const full = jaroWinkler(rawNorm, cNorm)
    const rawAl = rawNorm.replace(/[^a-z0-9]/g, '')
    const rawAlLen = rawAl.length
    // Compare raw to each distinctive "word" so nicknames like "Coke" score against "coca" / "cola".
    // Generic words ("Companies", "LLC") and length-penalized longer tokens reduce false positives (e.g. "Cooper").
    if (rawAlLen < 3) {
      score = full
    } else {
      const tokens = cNorm.split(/[^a-z0-9]+/).filter(Boolean)
      let tokenBest = 0
      let strongDistinctiveTokens = 0
      for (const tok of tokens) {
        const tScore = tokenMatchScore(rawNorm, rawAlLen, tok)
        tokenBest = Math.max(tokenBest, tScore)
        if (tScore >= 0.58) strongDistinctiveTokens++
      }
      let combined = Math.max(full, tokenBest)
      if (strongDistinctiveTokens >= 2) {
        combined = Math.min(1, combined + 0.04)
      }
      score = combined
    }
  }
  return Math.max(score, coreScoreBonus(rawNorm, cNorm))
}

export function scoreRawAgainstCanonicals(
  raw: string,
  canonicalNames: string[],
  index: Map<string, string[]>
): { name: string; score: number }[] {
  const rawNorm = normalizeForMatch(raw)
  const candidates = collectCandidates(rawNorm, canonicalNames, index)
  const scored = candidates.map((name) => ({ name, score: scorePair(rawNorm, name) }))
  scored.sort((a, b) => b.score - a.score)
  return scored
}

export function tierFromScores(scored: { name: string; score: number }[]): DeterministicTier {
  if (scored.length === 0) return 'needs_llm'
  const best = scored[0].score
  const second = scored.length > 1 ? scored[1].score : 0
  if (best < MATCH_SCORE_LOW) return 'needs_llm'
  if (best >= MATCH_SCORE_HIGH && best - second >= MATCH_SCORE_GAP) return 'auto'
  if (scored.length >= 2 && best - second < MATCH_SCORE_GAP) return 'ambiguous'
  if (best >= MATCH_SCORE_HIGH) return 'auto'
  return 'ambiguous'
}

export function matchDeterministicBatch(
  raws: string[],
  canonicalNames: string[]
): DeterministicMatchRow[] {
  if (canonicalNames.length === 0) {
    return raws.map((raw) => ({
      raw,
      tier: 'needs_llm' as const,
      best: null,
      bestScore: 0,
      topCandidates: [],
    }))
  }
  const index = buildBlockingIndex(canonicalNames)
  return raws.map((raw) => {
    const scored = scoreRawAgainstCanonicals(raw, canonicalNames, index)
    const tier = tierFromScores(scored)
    const top = scored.slice(0, Math.max(MATCH_LLM_TOP_K, 5))
    const best = scored[0] ?? null
    return {
      raw,
      tier,
      best: best ? best.name : null,
      bestScore: best ? best.score : 0,
      topCandidates: top,
    }
  })
}

export function topKForLlm(row: DeterministicMatchRow): string[] {
  const names = row.topCandidates.map((c) => c.name)
  const seen = new Set<string>()
  const out: string[] = []
  for (const n of names) {
    if (seen.has(n)) continue
    seen.add(n)
    out.push(n)
    if (out.length >= MATCH_LLM_TOP_K) break
  }
  return out
}

/**
 * First free header for matcher output: `Matched Company`, or `Matched Company 2`, etc.
 * Callers that need a stable key across re-runs should store the result once (e.g. in React state).
 */
export function pickMatchedCompanyHeader(existingHeaders: string[]): string {
  const base = MATCHED_COMPANY_HEADER
  if (!existingHeaders.includes(base)) return base
  let i = 2
  while (existingHeaders.includes(`${base} ${i}`)) i++
  return `${base} ${i}`
}

/**
 * Legacy export: second CSV column uses the contact file’s company column key (e.g. `Company`),
 * not a `(CRM)` suffix (that label is grid-only).
 */
export const MATCHER_TABLE_EXPORT_MATCH_HEADER = 'Company'

/**
 * Build rows and header list for exporting the matcher preview table (same column order as the grid).
 * Import column is `{companyColumnKey} (Import)`; matched values use the plain column key (no `(CRM)`).
 */
export function buildMatcherTableExport(
  contacts: ContactRow[],
  headers: string[],
  companyColumnKey: string,
  selection: Record<string, string>
): { data: ContactRow[]; csvHeaders: string[] } {
  const csvHeaders: string[] = []
  for (const h of headers) {
    if (h === companyColumnKey) {
      csvHeaders.push(`${h} (Import)`)
      csvHeaders.push(h)
    } else {
      csvHeaders.push(h)
    }
  }
  const data: ContactRow[] = contacts.map((row) => {
    const out: ContactRow = {}
    for (const h of headers) {
      if (h === companyColumnKey) {
        const raw = String(row[h] ?? '').trim()
        out[`${h} (Import)`] = String(row[h] ?? '')
        out[h] = selection[raw] ?? ''
      } else {
        out[h] = String(row[h] ?? '')
      }
    }
    return out
  })
  return { data, csvHeaders }
}
