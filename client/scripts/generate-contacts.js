/**
 * @file generate-contacts.js
 * @description Demo CSVs: 5k sparse contacts + 500 companies (canonical Name).
 * - 75 contacts: Company = variants only of 25 curated canonical clients (3 per client); never the exact canonical on the row.
 * - 4,925 contacts: off-list-seed-companies.csv; one shared Company string per seed (~500 unique off-list companies) so matcher batches stay small.
 * Rows 1–25: canonical names. Rows 26–500: S&P 500 fillers not appearing on any contact Company.
 *
 * Default (sparse list-match): writes public/demo-contacts-5k.csv + public/demo-companies-500.csv
 * Lite testing (500 contacts, 50 list-matchable = 50 canonicals × 1 variant each, no duplicate match rows): `node scripts/generate-contacts.js --sparse-500` → demo-contacts-500.csv + demo-companies-500-lite.csv.
 * Legacy (25×1000 dense match): `node scripts/generate-contacts.js --legacy` → *-legacy.csv (same column schemas).
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

/** 25 more canonicals used only for `--sparse-500` (50×1 matchable contacts). */
const COMPANIES_SPARSE_500_EXTRA = [
  { id: 'nike', canonicalName: 'Nike Inc.', names: ['Nike', 'Nike USA', 'Nike Corp', 'NIKE Inc'] },
  { id: 'starbucks', canonicalName: 'Starbucks Corporation', names: ['Starbucks', 'Starbucks Corp', 'Starbucks Coffee'] },
  { id: 'mcdonalds', canonicalName: "McDonald's Corporation", names: ['McDonalds', "McDonald's Corp", "McDonald's USA"] },
  { id: 'boeing', canonicalName: 'The Boeing Company', names: ['Boeing', 'Boeing Corp', 'Boeing Co'] },
  { id: 'jpm', canonicalName: 'JPMorgan Chase & Co.', names: ['JPMorgan', 'JP Morgan Chase', 'JPMorgan Chase'] },
  { id: 'bofa', canonicalName: 'Bank of America Corporation', names: ['BofA', 'Bank of America', 'Bank of America Corp'] },
  { id: 'wells', canonicalName: 'Wells Fargo & Company', names: ['Wells Fargo', 'Wells Fargo Corp', 'Wells Fargo Bank'] },
  { id: 'pfizer', canonicalName: 'Pfizer Inc.', names: ['Pfizer', 'Pfizer Corp', 'Pfizer Ltd'] },
  { id: 'jnj', canonicalName: 'Johnson & Johnson', names: ['J&J', 'Johnson and Johnson', 'Johnson & Johnson Inc'] },
  { id: 'merck', canonicalName: 'Merck & Co. Inc.', names: ['Merck', 'Merck Sharp Dohme', 'Merck & Co'] },
  { id: 'homedepot', canonicalName: 'The Home Depot Inc.', names: ['Home Depot', 'The Home Depot', 'Home Depot USA'] },
  { id: 'lowes', canonicalName: "Lowe's Companies Inc.", names: ['Lowes', "Lowe's Inc", 'Lowes Companies'] },
  { id: 'ups', canonicalName: 'United Parcel Service Inc.', names: ['UPS', 'United Parcel Service', 'UPS Inc'] },
  { id: 'fedex', canonicalName: 'FedEx Corporation', names: ['FedEx', 'Federal Express', 'FedEx Corp'] },
  { id: 'visa', canonicalName: 'Visa Inc.', names: ['Visa', 'Visa USA', 'Visa Corp'] },
  { id: 'mastercard', canonicalName: 'Mastercard Incorporated', names: ['Mastercard', 'MasterCard Inc', 'Mastercard Intl'] },
  { id: 'oracle', canonicalName: 'Oracle Corporation', names: ['Oracle', 'Oracle Corp', 'Oracle USA'] },
  { id: 'ibm', canonicalName: 'International Business Machines Corporation', names: ['IBM', 'International Business Machines', 'IBM Corp'] },
  { id: 'intel', canonicalName: 'Intel Corporation', names: ['Intel', 'Intel Corp', 'Intel Inc'] },
  { id: 'nvidia', canonicalName: 'NVIDIA Corporation', names: ['Nvidia', 'NVIDIA', 'NVIDIA Corp'] },
  { id: 'meta', canonicalName: 'Meta Platforms Inc.', names: ['Meta', 'Facebook Inc', 'Meta Platforms'] },
  { id: 'tesla', canonicalName: 'Tesla Inc.', names: ['Tesla', 'Tesla Motors', 'Tesla Corp'] },
  { id: 'alphabet', canonicalName: 'Alphabet Inc.', names: ['Google LLC', 'Google', 'Alphabet USA'] },
  { id: 'pg', canonicalName: 'The Procter & Gamble Company', names: ['P&G', 'Procter and Gamble', 'Procter & Gamble Co'] },
  { id: 'unitedhealth', canonicalName: 'UnitedHealth Group Incorporated', names: ['UnitedHealth', 'United Healthcare', 'UnitedHealth Group'] },
]

const COMPANIES_SPARSE_500 = [...COMPANIES, ...COMPANIES_SPARSE_500_EXTRA]

/** 25 curated clients × 3 = 75 list-matchable contacts (default sparse scenario) */
const MATCH_CONTACTS_PER_COMPANY = 3
const TOTAL_SPARSE_CONTACTS = 5000
/** First N filtered seeds (default sparse): 5×11 + 487×10 = 4,925 off-list rows */
const OFF_LIST_SEED_COUNT_DEFAULT = 492
const OFF_LIST_ELEVEN_ROW_SEEDS_DEFAULT = 5

/** Lite preset: 50×1 matchable + 45×10 off-list = 500 contacts */
const SPARSE_500_TOTAL = 500
const SPARSE_500_MATCH_PER_COMPANY = 1
const SPARSE_500_OFF_LIST_SEEDS = 45
const SPARSE_500_OFF_LIST_ELEVEN_ROW_SEEDS = 0
/** Legacy scenario: 25 × 1000 contacts, all variants of the 25 canonical clients */
const LEGACY_CONTACTS_PER_COMPANY = 1000
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

function normCompanyKey(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function loadOffListSeedNames() {
  const csvPath = path.join(__dirname, 'data', 'off-list-seed-companies.csv')
  const raw = fs.readFileSync(csvPath, 'utf8')
  const { data } = Papa.parse(raw, { header: true, skipEmptyLines: true })
  const out = []
  for (const row of data) {
    const n = row.Security?.trim()
    if (n) out.push(n)
  }
  return out
}

/**
 * First acceptable CRM-style variant for an off-list base.
 * Reserves exactly one normalized key when successful.
 * @param {Set<string>} reservedNorms
 * @returns {string|null}
 */
function pickFirstOffListCompanyName(baseName, groupIndex, reservedNorms) {
  const tryAccept = (candidate) => {
    const t = String(candidate).trim()
    if (t.length < 2) return null
    const k = normCompanyKey(t)
    if (reservedNorms.has(k)) return null
    reservedNorms.add(k)
    return t
  }

  const b = baseName.trim()
  const seq = []
  const push = (c) => seq.push(c)

  push(b)
  push(b.replace(/\s+(plc|inc\.?|corp\.?|corporation|ltd\.?|limited|nv|sa|ag|se|lp)\s*$/i, '').trim())
  push(b.replace(/\s*&\s*/g, ' and '))
  const parts = b.split(/\s+/).filter(Boolean)
  const first = parts[0] ?? ''
  const rest = parts.slice(1).join(' ')
  if (first.length >= 3) {
    push(`${first} Holdings`)
    push(`${first} Partners`)
    if (rest) {
      const shorter = `${first} ${rest.replace(/\b(inc|corp|ltd)\b\.?/gi, '').trim()}`.trim()
      if (shorter.length >= 4) push(shorter)
    }
  }
  push(`${b} Group`)
  push(`${b} Ltd`)
  push(`${b} Co`)
  push(`${b} International`)
  if (first.length >= 4) {
    const typo = first.slice(0, 2) + first[2] + first[1] + first.slice(3)
    if (typo !== first) {
      const t = rest ? `${typo} ${rest}`.trim() : typo
      push(t)
    }
  }
  push(`${b} Americas`)

  for (const c of seq) {
    const v = tryAccept(c)
    if (v) return v
  }

  let pad = 0
  while (pad < 80) {
    const v = tryAccept(`${b} Trading ${groupIndex}-${pad}`)
    if (v) return v
    pad++
  }
  return null
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

/** Must match client/src/constants/importSchemas.ts (NEW_CONTACT_HEADERS / COMPANY_REQUIRED_HEADERS). */
const CONTACT_HEADERS = ['First', 'Last', 'Company', 'Title', 'Email', 'City', 'State', 'Zip', 'Country']
const COMPANY_HEADERS = ['Name', 'Client Number', 'Open Date', 'Status', 'Client Originating Attorney']

function unparseCsvRows(rows, columns) {
  const text = Papa.unparse(rows, {
    columns: [...columns],
    newline: '\n',
    header: true,
  })
  return text.endsWith('\n') ? text : `${text}\n`
}

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

function mainLegacyDense() {
  const contactObjects = []
  const canonicalNames = COMPANIES.map((c) => c.canonicalName)

  for (const company of COMPANIES) {
    const pool = variantPool(company)
    for (let i = 0; i < LEGACY_CONTACTS_PER_COMPANY; i++) {
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
      `Need ${needFiller} filler company names but only ${fillerNames.length} S&P names remain after excluding contact variants. Add more source data in scripts/data.`,
    )
  }

  const companyObjects = [
    ...canonicalNames.map((name, idx) => buildCompanyRow(name, idx)),
    ...fillerNames.map((name, i) => buildCompanyRow(name, canonicalNames.length + i)),
  ]

  const contactsCsv = unparseCsvRows(contactObjects, CONTACT_HEADERS)
  const companiesCsv = unparseCsvRows(companyObjects, COMPANY_HEADERS)

  const outDir = path.join(__dirname, '..', 'public')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const contactsPath = path.join(outDir, 'demo-contacts-25k-legacy.csv')
  const companiesPath = path.join(outDir, 'demo-companies-500-legacy.csv')

  fs.writeFileSync(contactsPath, contactsCsv, 'utf8')
  fs.writeFileSync(companiesPath, companiesCsv, 'utf8')

  console.log(`[legacy 25×${LEGACY_CONTACTS_PER_COMPANY}] Wrote ${contactObjects.length} contacts to ${contactsPath}`)
  console.log(`[legacy] Wrote ${companyObjects.length} companies to ${companiesPath}`)
  console.log(`[legacy] Canonical names also verbatim in contacts (expect 0): ${canonicalAlsoInContacts.length}`)
  console.log(`[legacy] Filler company rows (S&P 500, not in contacts): ${fillerNames.length}`)
}

/**
 * @param {object} opts
 * @param {typeof COMPANIES} opts.companiesList
 * @param {number} opts.matchContactsPerCompany
 * @param {number} opts.totalContacts
 * @param {number} opts.offListSeedCount
 * @param {number} opts.offListElevenRowSeeds
 * @param {string} opts.contactsFilename
 * @param {string} opts.companiesFilename
 * @param {string} [opts.logTag]
 */
function runSparseMatch(opts) {
  const {
    companiesList,
    matchContactsPerCompany,
    totalContacts,
    offListSeedCount,
    offListElevenRowSeeds,
    contactsFilename,
    companiesFilename,
    logTag = 'sparse',
  } = opts

  const canonicalCount = companiesList.length
  const matchContactsTotal = canonicalCount * matchContactsPerCompany
  const offListContactsTotal =
    offListElevenRowSeeds * 11 + (offListSeedCount - offListElevenRowSeeds) * 10

  if (matchContactsTotal + offListContactsTotal !== totalContacts) {
    throw new Error(
      `[${logTag}] match (${matchContactsTotal}) + off-list (${offListContactsTotal}) must equal totalContacts (${totalContacts})`,
    )
  }

  const contactObjects = []
  const canonicalNames = companiesList.map((c) => c.canonicalName)
  const matchableVariantStrings = new Set()

  for (const company of companiesList) {
    const pool = variantPool(company)
    for (let i = 0; i < matchContactsPerCompany; i++) {
      const companyName = pool[i % pool.length]
      matchableVariantStrings.add(companyName)
      const globalIndex = contactObjects.length
      contactObjects.push(generateContact(companyName, globalIndex, company.id))
    }
  }

  if (contactObjects.length !== matchContactsTotal) {
    throw new Error(`[${logTag}] Expected ${matchContactsTotal} match contacts, got ${contactObjects.length}`)
  }

  const uniqueContactCompaniesAfterMatch = new Set(contactObjects.map((c) => c.Company))
  const canonicalSet = new Set(canonicalNames)

  const needFiller = COMPANY_ROWS_TARGET - canonicalNames.length
  const sp500Names = loadSp500SecurityNames()
  const fillerNames = realFillerCompanyNames(
    sp500Names,
    uniqueContactCompaniesAfterMatch,
    canonicalSet,
    needFiller,
  )

  if (fillerNames.length < needFiller) {
    throw new Error(
      `[${logTag}] Need ${needFiller} filler company names but only ${fillerNames.length} S&P names remain after excluding contact variants. Add more source data in scripts/data.`,
    )
  }

  const listNameStrings = [...canonicalNames, ...fillerNames]
  const listNameNorms = new Set(listNameStrings.map((n) => normCompanyKey(n)))
  const reservedNorms = new Set(listNameNorms)
  for (const c of contactObjects) reservedNorms.add(normCompanyKey(c.Company))

  const allSeeds = loadOffListSeedNames()
  const offListSeeds = allSeeds.filter((s) => !reservedNorms.has(normCompanyKey(s)))
  if (offListSeeds.length === 0) throw new Error('No off-list seeds after filtering; check off-list-seed-companies.csv')
  if (offListSeeds.length < offListSeedCount) {
    throw new Error(
      `[${logTag}] Need at least ${offListSeedCount} off-list seeds after filtering, got ${offListSeeds.length}`,
    )
  }

  let offListWritten = 0
  for (let gi = 0; gi < offListSeedCount; gi++) {
    const n = gi < offListElevenRowSeeds ? 11 : 10
    const baseSeed = offListSeeds[gi]
    const companyName = pickFirstOffListCompanyName(baseSeed, gi, reservedNorms)
    if (!companyName) {
      throw new Error(`Could not pick off-list company label for seed ${baseSeed} (group ${gi})`)
    }
    for (let i = 0; i < n; i++) {
      const globalIndex = contactObjects.length
      contactObjects.push(generateContact(companyName, globalIndex, `off-${gi}`))
      offListWritten++
    }
  }

  if (offListWritten !== offListContactsTotal) {
    throw new Error(`[${logTag}] Expected ${offListContactsTotal} off-list contacts, wrote ${offListWritten}`)
  }
  if (contactObjects.length !== totalContacts) {
    throw new Error(`[${logTag}] Expected ${totalContacts} contacts, got ${contactObjects.length}`)
  }

  const uniqueContactCompanies = new Set(contactObjects.map((c) => c.Company))
  const canonicalAlsoInContacts = canonicalNames.filter((n) => uniqueContactCompanies.has(n))

  const listNameExact = new Set(listNameStrings)
  for (const row of contactObjects) {
    if (listNameExact.has(row.Company)) {
      throw new Error(`Contact Company equals a list Name (forbidden): ${row.Company}`)
    }
  }

  let matchLike = 0
  for (const row of contactObjects) {
    if (matchableVariantStrings.has(row.Company)) matchLike++
  }
  if (matchLike !== matchContactsTotal) {
    throw new Error(
      `[${logTag}] Expected exactly ${matchContactsTotal} contacts on matchable variants, got ${matchLike}`,
    )
  }

  const companyObjects = [
    ...canonicalNames.map((name, idx) => buildCompanyRow(name, idx)),
    ...fillerNames.map((name, i) => buildCompanyRow(name, canonicalNames.length + i)),
  ]

  const contactsCsv = unparseCsvRows(contactObjects, CONTACT_HEADERS)
  const companiesCsv = unparseCsvRows(companyObjects, COMPANY_HEADERS)

  const outDir = path.join(__dirname, '..', 'public')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const contactsPath = path.join(outDir, contactsFilename)
  const companiesPath = path.join(outDir, companiesFilename)

  fs.writeFileSync(contactsPath, contactsCsv, 'utf8')
  fs.writeFileSync(companiesPath, companiesCsv, 'utf8')

  console.log(`[${logTag}] Wrote ${contactObjects.length} contacts to ${contactsPath}`)
  console.log(`[${logTag}] Wrote ${companyObjects.length} companies to ${companiesPath}`)
  console.log(
    `[${logTag}] List-matchable contacts (variants of ${canonicalCount} canonicals × ${matchContactsPerCompany}): ${matchContactsTotal}`,
  )
  console.log(`[${logTag}] Off-list contacts: ${offListContactsTotal}`)
  console.log(`[${logTag}] Canonical company rows: ${canonicalNames.length}`)
  console.log(`[${logTag}] Unique Company strings in contacts: ${uniqueContactCompanies.size}`)
  console.log(`[${logTag}] Approx matcher batches @30 unique names: ${Math.ceil(uniqueContactCompanies.size / 30)}`)
  console.log(`[${logTag}] Canonical names also verbatim in contacts (expect 0): ${canonicalAlsoInContacts.length}`)
  console.log(`[${logTag}] Filler company rows (S&P 500, not in contacts): ${fillerNames.length}`)
}

function mainSparseMatch() {
  runSparseMatch({
    companiesList: COMPANIES,
    matchContactsPerCompany: MATCH_CONTACTS_PER_COMPANY,
    totalContacts: TOTAL_SPARSE_CONTACTS,
    offListSeedCount: OFF_LIST_SEED_COUNT_DEFAULT,
    offListElevenRowSeeds: OFF_LIST_ELEVEN_ROW_SEEDS_DEFAULT,
    contactsFilename: 'demo-contacts-5k.csv',
    companiesFilename: 'demo-companies-500.csv',
    logTag: 'sparse-5k',
  })
}

function mainSparse500() {
  runSparseMatch({
    companiesList: COMPANIES_SPARSE_500,
    matchContactsPerCompany: SPARSE_500_MATCH_PER_COMPANY,
    totalContacts: SPARSE_500_TOTAL,
    offListSeedCount: SPARSE_500_OFF_LIST_SEEDS,
    offListElevenRowSeeds: SPARSE_500_OFF_LIST_ELEVEN_ROW_SEEDS,
    contactsFilename: 'demo-contacts-500.csv',
    companiesFilename: 'demo-companies-500-lite.csv',
    logTag: 'sparse-500',
  })
}

const runLegacy = process.argv.includes('--legacy')
const runSparse500 = process.argv.includes('--sparse-500')
if (runLegacy) mainLegacyDense()
else if (runSparse500) mainSparse500()
else mainSparseMatch()
