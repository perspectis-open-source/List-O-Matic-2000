/**
 * @file exportCsv.ts
 * @description CSV export helpers: filename sanitization, UTF-8 BOM, formula-injection mitigation, and download.
 * @module List-O-Matic-2000/client
 */
import Papa from 'papaparse'
import type { ContactRow } from './parseFile'

const MAX_FILENAME_SEGMENT_LENGTH = 200
const FORMULA_PREFIX_CHARS = ['=', '+', '-', '@', '\t', '\r']

const WINDOWS_RESERVED = new Set(
  ['CON', 'PRN', 'AUX', 'NUL'].concat(
    Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
    Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`)
  )
)

/**
 * Sanitizes a string for use as a filename segment (e.g. company name in "ai-results-{company}-{date}.csv").
 * Removes path characters and control chars, trims, collapses spaces, caps length.
 * Returns "search" if result is empty or a Windows-reserved name.
 */
export function sanitizeFilenameSegment(segment: string): string {
  let s = (segment ?? '')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (s.length > MAX_FILENAME_SEGMENT_LENGTH) s = s.slice(0, MAX_FILENAME_SEGMENT_LENGTH)
  const upper = s.toUpperCase()
  if (!s || WINDOWS_RESERVED.has(upper)) return 'search'
  return s
}

function sanitizeCellForFormulaInjection(value: string): string {
  const v = String(value ?? '')
  const first = v.charAt(0)
  if (FORMULA_PREFIX_CHARS.includes(first)) return '\t' + v
  return v
}

/**
 * Builds CSV string from data and headers. Applies formula-injection mitigation
 * (prefix cells starting with =, +, -, @, tab, or CR with a tab so Excel treats as text).
 * Caller may prepend BOM for Excel UTF-8 detection.
 */
export function toCsvString(data: ContactRow[], headers: string[]): string {
  const sanitized: ContactRow[] = data.map((row) => {
    const out: ContactRow = {}
    for (const h of headers) {
      out[h] = sanitizeCellForFormulaInjection(row[h] ?? '')
    }
    return out
  })
  return Papa.unparse(sanitized, { columns: headers })
}

const UTF8_BOM = '\uFEFF'

/**
 * Downloads the given data as a CSV file. Uses UTF-8 BOM for Excel compatibility.
 * Applies filename sanitization and formula-injection mitigation. Throws on failure.
 */
export function downloadCsv(data: ContactRow[], headers: string[], filename: string): void {
  const csv = toCsvString(data, headers)
  const blob = new Blob([UTF8_BOM + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    URL.revokeObjectURL(url)
  }
}
