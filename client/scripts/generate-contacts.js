/**
 * @file generate-contacts.js
 * @description Demo CSVs: 25k contacts (Company = variants only) + 500 companies (canonical Name).
 * Rows 1–25: canonical names per contact group. Rows 26–500: real public company names from S&P 500
 * (scripts/data/sp500-constituents.csv, ODbl), excluding any string that appears in contacts or canonicals.
 * Outputs: public/demo-contacts-25k.csv, public/demo-companies-500.csv
 * @module List-O-Matic-2000/client/scripts
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Papa from 'papaparse'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** canonicalName = company file truth; names = variants on contact rows only (never the canonical string). */
const COMPANIES = [
  {
    id: 'coke',
    canonicalName: 'Coca-Cola Company',
    names: [
      'Coca-Cola Ltd',
      'Coca Cola',
      'Coke',
      'Coke Bottling',
      'Coke Botling',
      'Coca-Cola Bottling',
      'Coca Cola Company',
      'Coca Cola Compnay',
      'Coca-Cola North America',
      'Fanta Inc.',
      'Sprite LLC',
      'Dasani Co',
      'Minute Maid',
      'Coca Cola Ltd',
      'Coke Consolidated',
      'CCE (Coca-Cola Enterprises)',
      'Coca-Cola Europacific',
      'Coca Cola Refreshements',
      'Coke Botling Co',
    ],
  },
  {
    id: 'colgate',
    canonicalName: 'Colgate-Palmolive',
    names: ['Colgate Palmolive', 'Colgate', 'Colgate Inc', 'Colgate-Palmoliv', 'Colgate Ltd', 'Colgate-Palmolive Co', 'Colgate Palmoliv'],
  },
  {
    id: 'costco',
    canonicalName: 'Costco Wholesale Corporation',
    names: ['Costco', 'Costco Wholsale', 'Costco Wholesale Corp', 'Costco Inc', 'Costco Wholesale', 'Costco Co', 'Costco Ltd', 'Costco Wholsale Corp'],
  },
  {
    id: 'cadbury',
    canonicalName: 'Cadbury plc',
    names: ['Cadbury', 'Cadbury Schweppes', 'Cadbury Inc', 'Cadbury Ltd', 'Cadbury Brothers', 'Cadbury UK', 'Cadbury Schwepps'],
  },
  {
    id: 'caterpillar',
    canonicalName: 'Caterpillar Inc.',
    names: ['Caterpillar', 'Cat', 'Caterpillar Corp', 'Caterpiller', 'Caterpillar Ltd', 'CAT Inc', 'Caterpillar Inc'],
  },
  {
    id: 'comcast',
    canonicalName: 'Comcast Corporation',
    names: ['Comcast', 'Comcast Corp', 'Comcast Inc', 'Comcast NBCUniversal', 'Comcast Cable', 'Comcast Ltd', 'Comcas'],
  },
  {
    id: 'chevron',
    canonicalName: 'Chevron Corporation',
    names: ['Chevron', 'Chevron Corp', 'Chevron USA', 'Chevron Ltd', 'Chevron Inc', 'Chevron Phillips', 'Chevorn'],
  },
  {
    id: 'chrysler',
    canonicalName: 'Chrysler LLC',
    names: ['Chrysler', 'Chrysler Group', 'Chrysler Corp', 'Chysler', 'Chrysler Inc', 'Stellantis Chrysler'],
  },
  {
    id: 'citigroup',
    canonicalName: 'Citigroup Inc.',
    names: ['Citigroup', 'Citi', 'Citigroup Corp', 'Citi Group', 'Citigrop', 'Citigroup Ltd'],
  },
  {
    id: 'cisco',
    canonicalName: 'Cisco Systems Inc.',
    names: ['Cisco', 'Cisco Inc', 'Cisco Corp', 'Cisco Ltd', 'Cico Systems', 'Cisco Sytems'],
  },
  {
    id: 'campbells',
    canonicalName: 'Campbell Soup Company',
    names: ["Campbell's", 'Campbell Soup', 'Campbell Soup Co', 'Campbells', "Campbell's Inc", 'Campbel Soup', 'Campbell Ltd'],
  },
  {
    id: 'conagra',
    canonicalName: 'Conagra Brands Inc.',
    names: ['Conagra', 'Conagra Inc', 'Conagra Corp', 'Conagra Ltd', 'Conagre', 'Conagra Brands'],
  },
  {
    id: 'cardinal',
    canonicalName: 'Cardinal Health Inc.',
    names: ['Cardinal Health', 'Cardinal Health Corp', 'Cardinal', 'Cardinal Helth', 'Cardinal Health Ltd'],
  },
  {
    id: 'cigna',
    canonicalName: 'Cigna Corporation',
    names: ['Cigna', 'Cigna Corp', 'Cigna Inc', 'Cigna Ltd', 'Cigna Health', 'Cignia'],
  },
  {
    id: 'cvs',
    canonicalName: 'CVS Health Corporation',
    names: ['CVS Health', 'CVS', 'CVS Pharmacy', 'CVS Health Corp', 'CVS Inc', 'CVS Caremark', 'CVS Helth'],
  },
  {
    id: 'pepsico',
    canonicalName: 'PepsiCo Inc.',
    names: ['PepsiCo', 'Pepsi Co', 'PepsiCo Inc.', 'Pepsi', 'PepsiCo Ltd', 'PepsiCo Corporation', 'PepsiCo Corp'],
  },
  {
    id: 'unilever',
    canonicalName: 'Unilever plc',
    names: ['Unilever', 'Unilever Inc', 'Unilever Ltd', 'Unilever USA', 'Unilever NV', 'Unilever Group', 'Unilver'],
  },
  {
    id: 'amazon',
    canonicalName: 'Amazon.com Inc.',
    names: ['Amazon', 'Amazon.com', 'Amazon Inc', 'Amazon Web Services', 'AWS', 'Amazon Ltd', 'Amazom'],
  },
  {
    id: 'microsoft',
    canonicalName: 'Microsoft Corporation',
    names: ['Microsoft', 'Microsoft Corp', 'Microsoft Inc', 'MSFT', 'Microsoft Ltd', 'Microsft'],
  },
  {
    id: 'apple',
    canonicalName: 'Apple Inc.',
    names: ['Apple Inc', 'Apple', 'Apple Computer', 'Apple Corp', 'Apple Ltd', 'AAPL', 'Aple Inc'],
  },
  {
    id: 'walmart',
    canonicalName: 'Walmart Inc.',
    names: ['Walmart', 'Walmart Stores', 'Walmart Corp', 'Walmart Ltd', 'Walmart Supercenter', 'Wal-Mart', 'Walmrt'],
  },
  {
    id: 'target',
    canonicalName: 'Target Corporation',
    names: ['Target', 'Target Corp', 'Target Inc', 'Target Ltd', 'Target Stores', 'Targe Corp'],
  },
  {
    id: 'ford',
    canonicalName: 'Ford Motor Company',
    names: ['Ford', 'Ford Motor', 'Ford Motor Co', 'Ford Inc', 'Ford Ltd', 'Ford Moter'],
  },
  {
    id: 'disney',
    canonicalName: 'The Walt Disney Company',
    names: ['Disney', 'Walt Disney', 'Disney Inc', 'Disney Co', 'Walt Disney Co', 'Disney Ltd'],
  },
  {
    id: 'netflix',
    canonicalName: 'Netflix Inc.',
    names: ['Netflix', 'Netflix LLC', 'Netflix Ltd', 'Netflix Inc.', 'Netflix Streaming', 'Netflx'],
  },
]

const CONTACTS_PER_COMPANY = 1000
const COMPANY_ROWS_TARGET = 500

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

const TITLES = ['Analyst', 'Manager', 'Director', 'VP', 'Engineer', 'Consultant', 'Specialist', 'Coordinator']
const CITIES = [
  ['Boston', 'MA', '02101'],
  ['Seattle', 'WA', '98101'],
  ['Austin', 'TX', '78701'],
  ['Chicago', 'IL', '60601'],
  ['Denver', 'CO', '80202'],
  ['Miami', 'FL', '33101'],
  ['Portland', 'OR', '97201'],
  ['Atlanta', 'GA', '30301'],
]
const COUNTRY = 'USA'

const STATUSES = ['Active', 'Active', 'Pending', 'Closed', 'On Hold']
const ATTORNEYS = [
  'Morgan Blake',
  'Jordan Lee',
  'Riley Chen',
  'Taylor Brooks',
  'Casey Nguyen',
  'Alex Rivera',
  'Sam Okonkwo',
  'Jamie Patel',
]

function pickDeterministic(arr, seed) {
  return arr[Math.abs(seed) % arr.length]
}

/** Contact-side company strings only; excludes canonical so it appears once in the companies file. */
function variantPool(company) {
  const canonical = company.canonicalName
  const variants = company.names.filter((n) => n !== canonical)
  return variants.length > 0 ? variants : company.names
}

function generateContact(companyName, rowIndex, companyId) {
  const first = pickDeterministic(FIRST_NAMES, rowIndex * 17 + companyId.length)
  const last = pickDeterministic(LAST_NAMES, rowIndex * 31 + companyId.charCodeAt(0))
  const title = pickDeterministic(TITLES, rowIndex + companyName.length)
  const email = `${first.toLowerCase()}.${last.toLowerCase()}.${rowIndex}@${companyId}.demo.com`
  const loc = pickDeterministic(CITIES, rowIndex + companyId.charCodeAt(1))
  const [city, state, zip] = loc
  return {
    First: first,
    Last: last,
    Company: companyName,
    Title: title,
    Email: email,
    City: city,
    State: state,
    Zip: zip,
    Country: COUNTRY,
  }
}

function escapeCsvCell(s) {
  const str = String(s ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

const CONTACT_HEADERS = ['First', 'Last', 'Company', 'Title', 'Email', 'City', 'State', 'Zip', 'Country']
const COMPANY_HEADERS = ['Name', 'Client Number', 'Open Date', 'Status', 'Client Originating Attorney']

function buildCompanyRow(displayName, index) {
  const num = 100000 + index
  const day = 1 + (index % 28)
  const month = 1 + (index % 12)
  const year = 2015 + (index % 10)
  const openDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return {
    Name: displayName,
    'Client Number': String(num),
    'Open Date': openDate,
    Status: STATUSES[index % STATUSES.length],
    'Client Originating Attorney': ATTORNEYS[index % ATTORNEYS.length],
  }
}

/** Deduped Security names; merges Alphabet Class A/C into one label. */
function loadSp500SecurityNames() {
  const csvPath = path.join(__dirname, 'data', 'sp500-constituents.csv')
  const raw = fs.readFileSync(csvPath, 'utf8')
  const { data } = Papa.parse(raw, { header: true, skipEmptyLines: true })
  const seen = new Set()
  const out = []
  for (const row of data) {
    let name = row.Security?.trim()
    if (!name) continue
    name = name.replace(/\s*\(Class [AC]\)\s*$/i, '').trim()
    if (seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out
}

/**
 * Pick real company names not present in contact Company strings or canonical list (exact match).
 */
function realFillerCompanyNames(sp500Names, uniqueContactCompanies, canonicalNameSet, needCount) {
  const filler = []
  for (const name of sp500Names) {
    if (filler.length >= needCount) break
    if (uniqueContactCompanies.has(name)) continue
    if (canonicalNameSet.has(name)) continue
    filler.push(name)
  }
  return filler
}

function main() {
  const contactObjects = []
  const canonicalNames = COMPANIES.map((c) => c.canonicalName)

  for (const company of COMPANIES) {
    const pool = variantPool(company)
    for (let i = 0; i < CONTACTS_PER_COMPANY; i++) {
      const companyName = pool[i % pool.length]
      const globalIndex = contactObjects.length
      contactObjects.push(generateContact(companyName, globalIndex, company.id))
    }
  }

  const uniqueContactCompanies = new Set(contactObjects.map((c) => c.Company))
  const canonicalAlsoInContacts = canonicalNames.filter((n) => uniqueContactCompanies.has(n))
  const canonicalSet = new Set(canonicalNames)

  const needFiller = COMPANY_ROWS_TARGET - canonicalNames.length
  const sp500Names = loadSp500SecurityNames()
  const fillerNames = realFillerCompanyNames(sp500Names, uniqueContactCompanies, canonicalSet, needFiller)

  if (fillerNames.length < needFiller) {
    throw new Error(
      `Need ${needFiller} filler company names but only ${fillerNames.length} S&P names remain after excluding contact variants. Add more source data in scripts/data.`
    )
  }

  const companyObjects = [
    ...canonicalNames.map((name, idx) => buildCompanyRow(name, idx)),
    ...fillerNames.map((name, i) => buildCompanyRow(name, canonicalNames.length + i)),
  ]

  const contactLines = [
    CONTACT_HEADERS.map(escapeCsvCell).join(','),
    ...contactObjects.map((row) => CONTACT_HEADERS.map((h) => escapeCsvCell(row[h])).join(',')),
  ]
  const companyLines = [
    COMPANY_HEADERS.map(escapeCsvCell).join(','),
    ...companyObjects.map((row) => COMPANY_HEADERS.map((h) => escapeCsvCell(row[h])).join(',')),
  ]

  const outDir = path.join(__dirname, '..', 'public')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const contactsPath = path.join(outDir, 'demo-contacts-25k.csv')
  const companiesPath = path.join(outDir, 'demo-companies-500.csv')

  fs.writeFileSync(contactsPath, contactLines.join('\n'), 'utf8')
  fs.writeFileSync(companiesPath, companyLines.join('\n'), 'utf8')

  console.log(`Wrote ${contactObjects.length} contacts to ${contactsPath}`)
  console.log(`Wrote ${companyObjects.length} companies to ${companiesPath}`)
  console.log(`Canonical company rows (real groups): ${canonicalNames.length}`)
  console.log(`Unique Company strings in contacts: ${uniqueContactCompanies.size}`)
  console.log(`Canonical names also verbatim in contacts (expect 0): ${canonicalAlsoInContacts.length}`)
  console.log(`Filler company rows (S&P 500, not in contacts): ${fillerNames.length}`)
}

main()
