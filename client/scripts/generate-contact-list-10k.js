/**
 * Generates a 10,000-row contact list CSV.
 * Company names are based on the CRM 500 companies but with slight misspellings/variations
 * so they do NOT exactly match the CRM list (for testing matching logic).
 * Output: client/public/contact-list-10k.csv
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Same 500 companies as crm-companies-500.csv
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
const crmCompanies = [...SEED_COMPANIES]
for (let i = 0; i < EXTRA; i++) crmCompanies.push(generateCompanyName(i))
const crmSet = new Set(crmCompanies)

const FIRST_NAMES = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth',
  'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen',
  'Christopher', 'Lisa', 'Daniel', 'Nancy', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra',
]
const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
]
const REGIONS = ['North', 'South', 'East', 'West', 'Central', 'Northeast', 'Southeast', 'Midwest']

const SUFFIX_VARIANTS = [' Inc', ' Corp', ' LLC', ' Ltd', ' Co', ' Company', ' Group', ' Inc.', ' Corp.']
const TYPO_PAIRS = [
  ['a', 'e'], ['e', 'i'], ['i', 'o'], ['o', 'u'], ['u', 'a'],
  ['c', 'k'], ['k', 'c'], ['s', 'z'], ['l', 'll'], ['n', 'nn'],
  ['er', 're'], ['or', 'ro'], ['te', 'et'], ['an', 'na'],
]

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Return a variant of the company name that is similar but NOT in the CRM list. */
function variantCompanyName(crmName) {
  let s = crmName.trim()
  const attempts = 20
  for (let a = 0; a < attempts; a++) {
    const roll = Math.random()
    let out = s

    if (roll < 0.4 && s.length > 3) {
      const i = Math.floor(Math.random() * (s.length - 2)) + 1
      const pair = pick(TYPO_PAIRS)
      if (s[i] === pair[0]) out = s.slice(0, i) + pair[1] + s.slice(i + 1)
      else if (s[i] === pair[1]) out = s.slice(0, i) + pair[0] + s.slice(i + 1)
      else if (i < s.length - 1 && s[i] !== ' ' && s[i + 1] !== ' ') {
        out = s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2)
      }
    } else if (roll < 0.7) {
      const suf = pick(SUFFIX_VARIANTS)
      if (!s.endsWith(suf.trim())) out = s + suf
      else out = s.replace(/\s+(Inc|Corp|LLC|Ltd|Co|Company|Group)\.?$/i, ' ' + pick(SUFFIX_VARIANTS).trim())
    } else {
      out = s.replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
      if (out === s) out = s.replace(/\s/g, '-')
    }

    out = out.trim()
    if (out && !crmSet.has(out)) return out
  }
  return s + ' (contact)'
}

function generateContact(companyName, index, companyIndex) {
  const first = pick(FIRST_NAMES)
  const last = pick(LAST_NAMES)
  const name = `${first} ${last}`
  const slug = String(companyIndex).padStart(3, '0')
  const email = `${first.toLowerCase()}.${last.toLowerCase()}.${index}@contact.demo.com`
  const phone = `+1-555-${String(Math.floor(Math.random() * 900) + 100)}-${String(Math.floor(Math.random() * 9000) + 1000)}`
  const region = pick(REGIONS)
  return { Name: name, Email: email, Company: companyName, Phone: phone, Region: region }
}

function escapeCsvCell(str) {
  const s = String(str ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

const TOTAL_CONTACTS = 10_000
const headers = ['Name', 'Email', 'Company', 'Phone', 'Region']

function main() {
  const rows = [headers.map(escapeCsvCell).join(',')]
  const contactsPerCompany = Math.ceil(TOTAL_CONTACTS / crmCompanies.length)

  for (let i = 0; i < TOTAL_CONTACTS; i++) {
    const companyIndex = i % crmCompanies.length
    const crmName = crmCompanies[companyIndex]
    const variantName = variantCompanyName(crmName)
    const contact = generateContact(variantName, i, companyIndex)
    rows.push(headers.map((h) => escapeCsvCell(contact[h])).join(','))
  }

  const csv = rows.join('\n')
  const outDir = path.join(__dirname, '..', 'public')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'contact-list-10k.csv')
  fs.writeFileSync(outPath, csv, 'utf8')
  console.log(`Wrote ${TOTAL_CONTACTS} contacts to ${outPath} (company names are variants of CRM list, not exact matches)`)
}

main()
