/**
 * Build scripts/data/off-list-seed-companies.csv from committed inputs (FTSE sample + NASDAQ listing),
 * excluding every S&P 500 security name in sp500-constituents.csv.
 *
 * Inputs (committed):
 * - data/sp500-constituents.csv
 * - data/ftse100-historical-sample.csv (historical FTSE snapshot; GitHub source)
 * - data/russell-2000-components.csv (Russell 2000 names; e.g. ikoniaris/Russell2000 snapshot)
 * - data/nasdaq-listed.csv (DataHub “core/nasdaq-listings”; refresh periodically)
 *
 * Run from client/: `npm run build-off-list-seed`
 *
 * @module List-O-Matic-2000/client/scripts
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Papa from 'papaparse'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function normalizeKey(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function loadSp500Keys() {
  const csvPath = path.join(__dirname, 'data', 'sp500-constituents.csv')
  const raw = fs.readFileSync(csvPath, 'utf8')
  const { data } = Papa.parse(raw, { header: true, skipEmptyLines: true })
  const keys = new Set()
  for (const row of data) {
    let name = row.Security?.trim()
    if (!name) continue
    name = name.replace(/\s*\(Class [AC]\)\s*$/i, '').trim()
    keys.add(normalizeKey(name))
  }
  return keys
}

/** Tail after " - " in NASDAQ listing names is usually an instrument, not part of the operating company. */
function isInstrumentTail(tail) {
  const t = String(tail).trim()
  if (!t) return false
  return (
    /\b(common shares?|ordinary shares?)\b/i.test(t) ||
    /\bamerican depositary|american depository|depositary shares?|depository shares?\b/i.test(t) ||
    /\b(ads|adss)\b/i.test(t) ||
    /\badrs?\b/i.test(t) ||
    /\b(unit|rights?|warrants?)\b/i.test(t) ||
    /\b(senior notes?|subordinated notes?|notes due|preferred stock|trust preferred)\b/i.test(t) ||
    /\d+(?:\.\d+)?%/.test(t) ||
    /\bseries\s+[a-z0-9]\b/i.test(t) ||
    /\brepresent(ing|s)\b/i.test(t) ||
    /\bordinary share\b/i.test(t)
  )
}

function takeOperatingCompanyName(raw) {
  let s = String(raw ?? '').trim()
  if (!s) return ''
  const parts = s.split(/\s+-\s+/)
  if (parts.length >= 2) {
    const tail = parts.slice(1).join(' - ')
    if (isInstrumentTail(tail)) s = parts[0].trim()
  }
  return s.trim()
}

/** Shell companies and fund-like names that read as junk in a CRM demo. */
function isDisallowedOperatingName(s) {
  const x = String(s).trim()
  if (x.length < 4 || x.length > 120) return true
  if (/\bETF\b/i.test(x)) return true
  if (/\bDepositary\b/i.test(x)) return true
  if (/1\s*\/\s*1000/i.test(x)) return true
  if (/\bSPAC\b/i.test(x)) return true
  if (/^A\s+SPAC\b/i.test(x)) return true
  if (/\bAcquisition\s+(?:Corp|Corporation|Company|Co\.?|Inc\.?)\b/i.test(x)) return true
  if (/\bAcquisition\s+Corp\.?\s+[IVX\d]/i.test(x)) return true
  if (/\bII\s+Acquisition\b/i.test(x) || /\bI\s+Acquisition\b/i.test(x)) return true
  if (/\bBlank Check\b/i.test(x)) return true
  if (/\bMerger Sub\b/i.test(x)) return true
  return false
}

function cleanNasdaqLine(name) {
  let s = takeOperatingCompanyName(name)
  if (!s) return ''
  if (isDisallowedOperatingName(s)) return ''
  s = s.replace(/\s+-\s+American Depositary Shares.*$/i, '')
  s = s.replace(/\s+-\s+Class\s+.*$/i, '')
  s = s.replace(/\s+-\s+Common Stock$/i, '')
  s = s.replace(/\s+-\s+Common Shares$/i, '')
  s = s.replace(/\s+-\s+Ordinary Shares$/i, '')
  s = s.replace(/\s+-\s+Ordinary Share$/i, '')
  s = s.replace(/\s+-\s+Units?$/i, '')
  s = s.replace(/\s+-\s+Rights?$/i, '')
  s = s.replace(/\s+-\s+Warrants?$/i, '')
  s = s.replace(/\s+-\s+Preferred Stock$/i, '')
  s = s.trim()
  s = takeOperatingCompanyName(s)
  if (isDisallowedOperatingName(s)) return ''
  return s
}

function loadNasdaqNames() {
  const csvPath = path.join(__dirname, 'data', 'nasdaq-listed.csv')
  const raw = fs.readFileSync(csvPath, 'utf8')
  const { data } = Papa.parse(raw, { header: true, skipEmptyLines: true })
  const out = []
  for (const row of data) {
    const rawName = row['Security Name'] ?? row.Security ?? ''
    const cleaned = cleanNasdaqLine(rawName)
    if (cleaned.length >= 3) out.push(cleaned)
  }
  return out
}

function loadFtseCommitted() {
  const csvPath = path.join(__dirname, 'data', 'ftse100-historical-sample.csv')
  const raw = fs.readFileSync(csvPath, 'utf8')
  const { data } = Papa.parse(raw, { header: true, skipEmptyLines: true })
  const out = []
  for (const row of data) {
    const n = row.name?.trim() || row.Name?.trim() || row.Security?.trim()
    if (n) out.push(n)
  }
  return out
}

/** Ticker + company name table (not exchange listing strings). */
function loadRussell2000Names() {
  const csvPath = path.join(__dirname, 'data', 'russell-2000-components.csv')
  if (!fs.existsSync(csvPath)) return []
  const raw = fs.readFileSync(csvPath, 'utf8')
  const { data } = Papa.parse(raw, { header: true, skipEmptyLines: true })
  const out = []
  for (const row of data) {
    let name = ''
    for (const [k, v] of Object.entries(row)) {
      if (k.trim().toLowerCase() === 'name') {
        name = String(v ?? '').trim()
        break
      }
    }
    if (name.length < 3) continue
    if (isDisallowedOperatingName(name)) continue
    out.push(name)
  }
  return out
}

function main() {
  const sp500Keys = loadSp500Keys()
  const nasdaqNames = loadNasdaqNames()
  const ftseNames = loadFtseCommitted()
  const russellNames = loadRussell2000Names()

  const merged = [...ftseNames, ...russellNames, ...nasdaqNames]
  const seen = new Set()
  const out = []
  for (const name of merged) {
    const k = normalizeKey(name)
    if (!k || k.length < 3) continue
    if (sp500Keys.has(k)) continue
    if (seen.has(k)) continue
    seen.add(k)
    out.push(name)
  }

  const minNeed = 1700
  if (out.length < minNeed) {
    throw new Error(
      `Only ${out.length} off-list seeds after filtering (need >= ${minNeed}). Check russell-2000-components.csv, nasdaq-listed.csv, and sp500 overlap.`,
    )
  }

  const lines = ['Security', ...out.map((s) => s.replace(/\r?\n/g, ' '))]
  const dest = path.join(__dirname, 'data', 'off-list-seed-companies.csv')
  fs.writeFileSync(dest, lines.join('\n') + '\n', 'utf8')
  console.log(`Wrote ${out.length} rows to ${dest}`)
}

main()
