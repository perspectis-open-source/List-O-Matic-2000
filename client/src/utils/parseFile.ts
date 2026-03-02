import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export type ContactRow = Record<string, string>

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

export function parseCSV(file: File): Promise<{ data: ContactRow[]; headers: string[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(result) {
        const data = (result.data || []) as ContactRow[]
        const headers = result.meta?.fields || (data[0] ? Object.keys(data[0]) : [])
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
        const data = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as ContactRow[]
        const headers = data[0] ? Object.keys(data[0]) : []
        resolve({ data, headers })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

export async function parseContactFile(file: File): Promise<{
  data: ContactRow[]
  headers: string[]
  companyColumnKey: string | null
  entityColumnKey: string | null
}> {
  const name = (file.name || '').toLowerCase()
  const { data, headers } = name.endsWith('.xlsx')
    ? await parseExcel(file)
    : await parseCSV(file)
  const companyColumnKey = detectCompanyColumnKey(headers)
  const entityColumnKey = detectEntityColumnKey(headers)
  return { data, headers, companyColumnKey, entityColumnKey }
}
