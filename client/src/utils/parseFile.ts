/**
 * @file parseFile.ts
 * @description Parse CSV/Excel contact and company files; validate headers; detect company/entity columns.
 * @module List-O-Matic-2000/client
 */
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import {
  NEW_CONTACT_HEADERS,
  LEGACY_CONTACT_MIN_HEADERS,
  COMPANY_REQUIRED_HEADERS,
  type ContactSchemaKind,
} from '../constants/importSchemas'

export type ContactRow = Record<string, string>
export type CompanyRow = Record<string, string>

const COMPANY_COLUMN_CANDIDATES = ['Company', 'company', 'Organization', 'organization', 'Employer', 'employer']
const ENTITY_COLUMN_CANDIDATES = ['Entity', 'entity', 'Company Entity', 'company entity', 'Canonical Company', 'canonical company']

export function detectCompanyColumnKey(headers: string[]): string | null {
  for (const candidate of COMPANY_COLUMN_CANDIDATES) {
    if (headers.includes(candidate)) return candidate
  }
  return null
}

export function detectEntityColumnKey(headers: string[]): string | null {
  for (const candidate of ENTITY_COLUMN_CANDIDATES) {
    if (headers.includes(candidate)) return candidate
  }
  return null
}

function stripBom(s: string): string {
  if (s.charCodeAt(0) === 0xfeff) return s.slice(1)
  return s
}

/** Normalize header list from parser (BOM on first column only). */
export function normalizeHeaderRow(headers: string[]): string[] {
  if (headers.length === 0) return headers
  const copy = [...headers]
  copy[0] = stripBom(copy[0])
  return copy
}

export function validateNoBlankOrDuplicateHeaders(headers: string[]): void {
  const seen = new Set<string>()
  for (const raw of headers) {
    const h = raw
    if (h === '') {
      throw new Error('Invalid header row: empty column name. Check for trailing commas or blank columns.')
    }
    if (seen.has(h)) {
      throw new Error(`Invalid header row: duplicate column "${h}". Each column name must appear only once.`)
    }
    seen.add(h)
  }
}

function hasRequiredEachOnce(headers: string[], required: readonly string[]): boolean {
  return required.every((r) => headers.filter((h) => h === r).length === 1)
}

export function headersMatchCompanyImport(headers: string[]): boolean {
  try {
    validateNoBlankOrDuplicateHeaders(headers)
  } catch {
    return false
  }
  return hasRequiredEachOnce(headers, COMPANY_REQUIRED_HEADERS)
}

export function headersMatchNewContacts(headers: string[]): boolean {
  try {
    validateNoBlankOrDuplicateHeaders(headers)
  } catch {
    return false
  }
  return hasRequiredEachOnce(headers, NEW_CONTACT_HEADERS)
}

export function headersMatchLegacyContacts(headers: string[]): boolean {
  try {
    validateNoBlankOrDuplicateHeaders(headers)
  } catch {
    return false
  }
  return hasRequiredEachOnce(headers, LEGACY_CONTACT_MIN_HEADERS)
}

export function classifyContactHeaders(headers: string[]): ContactSchemaKind {
  validateNoBlankOrDuplicateHeaders(headers)
  const isNew = hasRequiredEachOnce(headers, NEW_CONTACT_HEADERS)
  if (isNew) return 'new'
  const isLegacy = hasRequiredEachOnce(headers, LEGACY_CONTACT_MIN_HEADERS)
  if (isLegacy) return 'legacy'
  const missingNew = NEW_CONTACT_HEADERS.filter((r) => !headers.includes(r))
  const missingLegacy = LEGACY_CONTACT_MIN_HEADERS.filter((r) => !headers.includes(r))
  let msg = 'Invalid contacts file. '
  if (missingNew.length <= missingLegacy.length) {
    msg += `Missing required columns for the standard layout: ${missingNew.map((m) => `"${m}"`).join(', ')}. `
    msg += `Expected columns: ${NEW_CONTACT_HEADERS.join(', ')}.`
  } else {
    msg += `Missing required columns for the legacy layout: ${missingLegacy.map((m) => `"${m}"`).join(', ')}. `
    msg += `Legacy minimum: ${LEGACY_CONTACT_MIN_HEADERS.join(', ')}.`
  }
  if (headersMatchCompanyImport(headers)) {
    msg += ' This file looks like a companies import — use "Import companies" instead.'
  }
  throw new Error(msg)
}

export function validateCompanyHeaders(headers: string[]): void {
  validateNoBlankOrDuplicateHeaders(headers)
  if (hasRequiredEachOnce(headers, COMPANY_REQUIRED_HEADERS)) return
  const missing = COMPANY_REQUIRED_HEADERS.filter((r) => !headers.includes(r))
  let msg = `Invalid companies file. Missing required columns: ${missing.map((m) => `"${m}"`).join(', ')}. `
  msg += `Expected: ${COMPANY_REQUIRED_HEADERS.join(', ')}.`
  if (headersMatchNewContacts(headers) || headersMatchLegacyContacts(headers)) {
    msg += ' This file looks like a contacts import — use "Import contacts" instead.'
  }
  throw new Error(msg)
}

export function parseCSV(file: File): Promise<{ data: ContactRow[]; headers: string[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(result) {
        const data = (result.data || []) as ContactRow[]
        const rawFields = result.meta?.fields || (data[0] ? Object.keys(data[0]) : [])
        const headers = normalizeHeaderRow(rawFields)
        validateNoBlankOrDuplicateHeaders(headers)
        resolve({ data, headers })
      },
      error(err) {
        reject(err)
      },
    })
  })
}

export function parseExcel(file: File): Promise<{ data: ContactRow[]; headers: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const buf = e.target?.result
        if (!buf || !(buf instanceof ArrayBuffer)) {
          reject(new Error('Failed to read file'))
          return
        }
        const wb = XLSX.read(buf, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
        const headerCells = grid[0] ? grid[0].map((c) => String(c ?? '')) : []
        const headers = normalizeHeaderRow(headerCells)
        validateNoBlankOrDuplicateHeaders(headers)
        const data = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as ContactRow[]
        resolve({ data, headers })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

async function parseSpreadsheet(file: File): Promise<{ data: ContactRow[]; headers: string[] }> {
  const name = (file.name || '').toLowerCase()
  return name.endsWith('.xlsx') ? parseExcel(file) : parseCSV(file)
}

export async function parseContactFile(file: File): Promise<{
  data: ContactRow[]
  headers: string[]
  companyColumnKey: string | null
  entityColumnKey: string | null
  contactSchemaKind: ContactSchemaKind
}> {
  const { data, headers } = await parseSpreadsheet(file)
  const contactSchemaKind = classifyContactHeaders(headers)
  const companyColumnKey = detectCompanyColumnKey(headers)
  const entityColumnKey = detectEntityColumnKey(headers)
  return { data, headers, companyColumnKey, entityColumnKey, contactSchemaKind }
}

export async function parseCompanyFile(file: File): Promise<{ data: CompanyRow[]; headers: string[] }> {
  const { data, headers } = await parseSpreadsheet(file)
  validateCompanyHeaders(headers)
  return { data: data as CompanyRow[], headers }
}
