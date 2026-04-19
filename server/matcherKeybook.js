/**
 * @file matcherKeybook.js
 * @description JSONL keybook: persisted Name→parent, raw→parent, and raw→{match,parent} for matcher warm-start (gitignored data dir).
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const COMPANY_KEY_JSONL = 'company-key.jsonl'
export const CONTACT_KEY_JSONL = 'contact-company-key.jsonl'
export const CONTACT_MATCH_JSONL = 'contact-company-match.jsonl'

export function getMatcherKeybookDir() {
  const override = process.env.MATCHER_KEYBOOK_DIR?.trim()
  if (override) return path.resolve(override)
  return path.join(__dirname, 'data', 'matcher-keybook')
}

function companyKeyPath() {
  return path.join(getMatcherKeybookDir(), COMPANY_KEY_JSONL)
}

function contactKeyPath() {
  return path.join(getMatcherKeybookDir(), CONTACT_KEY_JSONL)
}

function contactMatchPath() {
  return path.join(getMatcherKeybookDir(), CONTACT_MATCH_JSONL)
}

/**
 * @returns {Promise<Map<string, string>>} name → parentCompany
 */
export async function readCompanyKeybook() {
  const map = new Map()
  let text
  try {
    text = await fs.readFile(companyKeyPath(), 'utf8')
  } catch {
    return map
  }
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t) continue
    try {
      const o = JSON.parse(t)
      if (
        o &&
        typeof o.name === 'string' &&
        typeof o.parentCompany === 'string' &&
        o.name.trim() !== '' &&
        o.parentCompany.trim() !== ''
      ) {
        map.set(o.name.trim(), o.parentCompany.trim())
      }
    } catch {
      console.warn('[matcherKeybook] skip invalid company-key line')
    }
  }
  return map
}

/**
 * @returns {Promise<Map<string, string>>} raw → parentCompany
 */
export async function readContactKeybook() {
  const map = new Map()
  let text
  try {
    text = await fs.readFile(contactKeyPath(), 'utf8')
  } catch {
    return map
  }
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t) continue
    try {
      const o = JSON.parse(t)
      if (
        o &&
        typeof o.raw === 'string' &&
        typeof o.parentCompany === 'string' &&
        o.raw.trim() !== '' &&
        o.parentCompany.trim() !== ''
      ) {
        map.set(o.raw.trim(), o.parentCompany.trim())
      }
    } catch {
      console.warn('[matcherKeybook] skip invalid contact-company-key line')
    }
  }
  return map
}

/**
 * Seed parent labels for matcher request items: prefer contact-company-key.jsonl, else parentCompany
 * from contact-company-match.jsonl when the contact key has no row for that raw.
 * @param {{ raw: string }[]} items
 * @param {Map<string, string>} keybookContactByRaw raw → parentCompany
 * @param {Map<string, { match: string | null, parentCompany: string }>} keybookMatchByRaw
 * @returns {{ parentByRaw: Map<string, string>, backfillContactKey: { raw: string, parentCompany: string }[] }}
 */
export function seedParentByRawFromKeybooks(items, keybookContactByRaw, keybookMatchByRaw) {
  /** @type {Map<string, string>} */
  const parentByRaw = new Map()
  /** @type { { raw: string, parentCompany: string }[] } */
  const backfillContactKey = []
  const keyContact = keybookContactByRaw instanceof Map ? keybookContactByRaw : new Map()
  const keyMatch = keybookMatchByRaw instanceof Map ? keybookMatchByRaw : new Map()

  for (const it of items) {
    const raw = typeof it.raw === 'string' ? it.raw.trim() : ''
    if (!raw) continue
    const fromContact = keyContact.get(raw)
    const hadContactKey = fromContact != null && String(fromContact).trim() !== ''
    let p = hadContactKey ? String(fromContact).trim() : ''
    if (!p) {
      const st = keyMatch.get(raw)
      const mp = st && typeof st.parentCompany === 'string' ? st.parentCompany.trim() : ''
      if (mp) p = mp
    }
    parentByRaw.set(raw, p)
    if (!hadContactKey && p) backfillContactKey.push({ raw, parentCompany: p })
  }
  return { parentByRaw, backfillContactKey }
}

/**
 * Whether the closed-list fallback LLM should run for this import `raw`, after step 3 and match replay.
 * - Skip if `byRawResults` already has a `match`.
 * - If this contact has **no** inferred parent (empty in `parentByRaw` after keybook seed + step 2), run fallback:
 *   there is no parent for deterministic parent-alignment, so we still allow the closed-list model pass.
 * - If the contact **has** a parent and the match keybook stores an explicit no-match (`match` null/empty), skip
 *   repeat fallback (avoid re-tokenizing the full list for the same outcome).
 * - If the contact has a parent but there is no keybook row, or a non-empty stored `match` needs retry, run fallback.
 * @param {string} raw
 * @param {Map<string, { raw: string, match?: string | null, alternates?: string[] }>} byRawResults
 * @param {Map<string, string>} parentByRaw raw → inferred parent for this run
 * @param {Map<string, { match: string | null, parentCompany: string }>} keyMatch
 */
export function shouldRunMatchFallbackForRaw(raw, byRawResults, parentByRaw, keyMatch) {
  const cur = byRawResults instanceof Map ? byRawResults.get(raw) : undefined
  if (cur?.match) return false
  const parent = parentByRaw instanceof Map ? String(parentByRaw.get(raw) ?? '').trim() : ''
  if (!parent) return true
  const st = keyMatch instanceof Map ? keyMatch.get(raw) : undefined
  if (st == null) return true
  const persisted = st.match != null && typeof st.match === 'string' ? st.match.trim() : ''
  return persisted !== ''
}

/** @returns {Promise<Map<string, { match: string | null, parentCompany: string }>>} raw → { match, parentCompany } */
export async function readContactMatchbook() {
  const map = new Map()
  let text
  try {
    text = await fs.readFile(contactMatchPath(), 'utf8')
  } catch {
    return map
  }
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t) continue
    try {
      const o = JSON.parse(t)
      if (!o || typeof o.raw !== 'string' || o.raw.trim() === '') continue
      const raw = o.raw.trim()
      let match = null
      if (o.match != null) {
        if (typeof o.match === 'string') {
          const ms = o.match.trim()
          match = ms === '' ? null : ms
        }
      }
      const parentCompany = typeof o.parentCompany === 'string' ? o.parentCompany.trim() : ''
      map.set(raw, { match, parentCompany })
    } catch {
      console.warn('[matcherKeybook] skip invalid contact-match line')
    }
  }
  return map
}

/**
 * Merge-replace rows by `raw` and rewrite the match keybook (sorted by raw).
 * @param {{ raw: string, match: string | null, parentCompany: string }[]} rows
 */
export async function persistContactMatches(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return
  const dir = getMatcherKeybookDir()
  await fs.mkdir(dir, { recursive: true })
  const merged = await readContactMatchbook()
  for (const row of rows) {
    const raw = typeof row.raw === 'string' ? row.raw.trim() : ''
    if (!raw) continue
    const parentCompany = typeof row.parentCompany === 'string' ? row.parentCompany.trim() : ''
    let match = null
    if (row.match != null && typeof row.match === 'string') {
      const ms = row.match.trim()
      match = ms === '' ? null : ms
    }
    merged.set(raw, { match, parentCompany })
  }
  const lines = [...merged.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([raw, { match, parentCompany }]) =>
      JSON.stringify({ raw, match: match ?? null, parentCompany }),
    )
  const file = contactMatchPath()
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  const body = lines.length ? `${lines.join('\n')}\n` : ''
  await fs.writeFile(tmp, body, 'utf8')
  await fs.rename(tmp, file)
}

/**
 * Sorted arrays for GET /api/matcher-keybook (no OpenAI).
 * @returns {Promise<{ companyKey: { name: string, parentCompany: string }[], contactCompanyKey: { raw: string, parentCompany: string }[], contactCompanyMatch: { contactCompany: string, matchedCompany: string, parentCompany: string }[] }>}
 */
export async function getMatcherKeybookSnapshot() {
  const company = await readCompanyKeybook()
  const contact = await readContactKeybook()
  const matches = await readContactMatchbook()
  const companyKey = [...company.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, parentCompany]) => ({ name, parentCompany }))
  const contactCompanyKey = [...contact.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([raw, parentCompany]) => ({ raw, parentCompany }))
  const contactCompanyMatch = [...matches.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([raw, { match, parentCompany }]) => ({
      contactCompany: raw,
      matchedCompany: match ?? '',
      parentCompany,
    }))
  return { companyKey, contactCompanyKey, contactCompanyMatch }
}

/**
 * @param {{ name: string, parentCompany: string }[]} newEntries
 */
export async function persistNewCanonParents(newEntries) {
  if (!Array.isArray(newEntries) || newEntries.length === 0) return
  const dir = getMatcherKeybookDir()
  await fs.mkdir(dir, { recursive: true })
  const merged = await readCompanyKeybook()
  for (const row of newEntries) {
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    const parentCompany = typeof row.parentCompany === 'string' ? row.parentCompany.trim() : ''
    if (!name || !parentCompany) continue
    merged.set(name, parentCompany)
  }
  const lines = [...merged.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, parentCompany]) => JSON.stringify({ name, parentCompany }))
  const file = companyKeyPath()
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  const body = lines.length ? `${lines.join('\n')}\n` : ''
  await fs.writeFile(tmp, body, 'utf8')
  await fs.rename(tmp, file)
}

/**
 * @param {{ raw: string, parentCompany: string }[]} newEntries
 */
export async function persistNewContactParents(newEntries) {
  if (!Array.isArray(newEntries) || newEntries.length === 0) return
  const dir = getMatcherKeybookDir()
  await fs.mkdir(dir, { recursive: true })
  const merged = await readContactKeybook()
  for (const row of newEntries) {
    const raw = typeof row.raw === 'string' ? row.raw.trim() : ''
    const parentCompany = typeof row.parentCompany === 'string' ? row.parentCompany.trim() : ''
    if (!raw || !parentCompany) continue
    merged.set(raw, parentCompany)
  }
  const lines = [...merged.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([raw, parentCompany]) => JSON.stringify({ raw, parentCompany }))
  const file = contactKeyPath()
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  const body = lines.length ? `${lines.join('\n')}\n` : ''
  await fs.writeFile(tmp, body, 'utf8')
  await fs.rename(tmp, file)
}
