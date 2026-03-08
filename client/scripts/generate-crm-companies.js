/**
 * @file generate-crm-companies.js
 * @description Writes client/public/crm-companies-500.csv with 500 company names (one per line, header "Company").
 * @module List-O-Matic-2000/client/scripts
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SEED_COMPANIES = [
  'Coca-Cola', 'Colgate-Palmolive', 'Costco Wholesale', 'Cadbury', 'Caterpillar',
  'Comcast', 'Chevron', 'Chrysler', 'Citigroup', 'Cisco', "Campbell's", 'Conagra',
  'Cardinal Health', 'Cigna', 'CVS Health', 'PepsiCo', 'Unilever', 'Amazon', 'Microsoft',
  'Apple', 'Walmart', 'Target', 'Ford', 'Disney', 'Netflix',
]
const PREFIXES = [
  'Global', 'United', 'National', 'American', 'Pacific', 'Atlantic', 'Premier', 'Summit', 'Apex', 'Vertex',
  'Prime', 'Elite', 'Core', 'First', 'Main', 'Central', 'Metro', 'Urban', 'North', 'South',
]
const STEMS = [
  'Tech', 'Systems', 'Solutions', 'Services', 'Industries', 'Group', 'Partners', 'Holdings', 'Ventures', 'Capital',
  'Medical', 'Health', 'Energy', 'Finance', 'Legal', 'Media', 'Retail', 'Logistics', 'Manufacturing', 'Consulting',
]
const SUFFIXES = ['Inc', 'Corp', 'LLC', 'Ltd', 'Co', 'Company', 'Group', 'Partners']

function generateCompanyName(i) {
  const p = PREFIXES[i % PREFIXES.length]
  const s = STEMS[Math.floor(i / PREFIXES.length) % STEMS.length]
  const suf = SUFFIXES[i % SUFFIXES.length]
  return `${p} ${s} ${suf}`
}

const EXTRA = 500 - SEED_COMPANIES.length
const generated = []
for (let i = 0; i < EXTRA; i++) generated.push(generateCompanyName(i))
const companies = [...SEED_COMPANIES, ...generated]

function escapeCsv(s) {
  const str = String(s ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`
  return str
}

const csv = ['Company', ...companies.map(escapeCsv)].join('\n')
const outDir = path.join(__dirname, '..', 'public')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'crm-companies-500.csv')
fs.writeFileSync(outPath, csv, 'utf8')
console.log(`Wrote ${companies.length} companies to ${outPath}`)
