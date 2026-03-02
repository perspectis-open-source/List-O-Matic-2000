/**
 * Generates a 25,000-row demo contact CSV.
 * 25 companies × 1,000 contacts. 15 companies start with "C" (Coke + 14 others);
 * 10 do not. Includes typos/misspellings. Entity column for hover tooltip.
 * Output: client/public/demo-contacts-25k.csv
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// entityLabel = canonical name for Entity column (hover tooltip)
const COMPANIES = [
  // 15 companies starting with C
  {
    id: 'coke',
    entityLabel: 'Coca-Cola',
    names: [
      'Coca-Cola Company',
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
    entityLabel: 'Colgate-Palmolive',
    names: ['Colgate-Palmolive', 'Colgate Palmolive', 'Colgate', 'Colgate Inc', 'Colgate-Palmoliv', 'Colgate Ltd', 'Colgate-Palmolive Co', 'Colgate Palmoliv'],
  },
  {
    id: 'costco',
    entityLabel: 'Costco Wholesale',
    names: ['Costco Wholesale', 'Costco', 'Costco Wholsale', 'Costco Wholesale Corp', 'Costco Inc', 'Costco Wholesale Corporation', 'Costco Co', 'Costco Ltd', 'Costco Wholsale Corp'],
  },
  {
    id: 'cadbury',
    entityLabel: 'Cadbury',
    names: ['Cadbury', 'Cadbury plc', 'Cadbury Schweppes', 'Cadbury Inc', 'Cadbury Ltd', 'Cadbury Brothers', 'Cadbury UK', 'Cadbury', 'Cadbury Schwepps'],
  },
  {
    id: 'caterpillar',
    entityLabel: 'Caterpillar',
    names: ['Caterpillar Inc', 'Caterpillar', 'Cat', 'Caterpillar Corp', 'Caterpiller', 'Caterpillar Ltd', 'CAT Inc', 'Caterpillar Inc.'],
  },
  {
    id: 'comcast',
    entityLabel: 'Comcast',
    names: ['Comcast', 'Comcast Corporation', 'Comcast Corp', 'Comcast Inc', 'Comcast NBCUniversal', 'Comcast Cable', 'Comcast Ltd', 'Comcas'],
  },
  {
    id: 'chevron',
    entityLabel: 'Chevron',
    names: ['Chevron', 'Chevron Corporation', 'Chevron Corp', 'Chevron USA', 'Chevron Ltd', 'Chevron Inc', 'Chevron Phillips', 'Chevorn'],
  },
  {
    id: 'chrysler',
    entityLabel: 'Chrysler',
    names: ['Chrysler', 'Chrysler LLC', 'Chrysler Group', 'Chrysler Corp', 'Chysler', 'Chrysler Inc', 'Stellantis Chrysler'],
  },
  {
    id: 'citigroup',
    entityLabel: 'Citigroup',
    names: ['Citigroup', 'Citigroup Inc', 'Citi', 'Citigroup Corp', 'Citi Group', 'Citigrop', 'Citigroup Ltd'],
  },
  {
    id: 'cisco',
    entityLabel: 'Cisco',
    names: ['Cisco', 'Cisco Systems', 'Cisco Inc', 'Cisco Corp', 'Cisco Ltd', 'Cico Systems', 'Cisco Sytems'],
  },
  {
    id: 'campbells',
    entityLabel: "Campbell's",
    names: ["Campbell's", "Campbell Soup", "Campbell Soup Co", "Campbells", "Campbell's Inc", "Campbel Soup", "Campbell Ltd"],
  },
  {
    id: 'conagra',
    entityLabel: 'Conagra',
    names: ['Conagra Brands', 'Conagra', 'Conagra Inc', 'Conagra Corp', 'Conagra Ltd', 'Conagre', 'Conagra Brands Inc'],
  },
  {
    id: 'cardinal',
    entityLabel: 'Cardinal Health',
    names: ['Cardinal Health', 'Cardinal Health Inc', 'Cardinal Health Corp', 'Cardinal', 'Cardinal Helth', 'Cardinal Health Ltd'],
  },
  {
    id: 'cigna',
    entityLabel: 'Cigna',
    names: ['Cigna', 'Cigna Corporation', 'Cigna Corp', 'Cigna Inc', 'Cigna Ltd', 'Cigna Health', 'Cignia'],
  },
  {
    id: 'cvs',
    entityLabel: 'CVS Health',
    names: ['CVS Health', 'CVS', 'CVS Pharmacy', 'CVS Health Corp', 'CVS Inc', 'CVS Caremark', 'CVS Helth'],
  },
  // 10 companies not starting with C
  {
    id: 'pepsico',
    entityLabel: 'PepsiCo',
    names: ['PepsiCo', 'PepsiCo Inc', 'Pepsi Co', 'PepsiCo Inc.', 'Pepsi', 'PepsiCo Ltd', 'PepsiCo Corporation', 'PepsiCo Corp'],
  },
  {
    id: 'unilever',
    entityLabel: 'Unilever',
    names: ['Unilever', 'Unilever plc', 'Unilever Inc', 'Unilever Ltd', 'Unilever USA', 'Unilever NV', 'Unilever Group', 'Unilver'],
  },
  {
    id: 'amazon',
    entityLabel: 'Amazon',
    names: ['Amazon', 'Amazon.com', 'Amazon Inc', 'Amazon.com Inc', 'Amazon Web Services', 'AWS', 'Amazon Ltd', 'Amazom'],
  },
  {
    id: 'microsoft',
    entityLabel: 'Microsoft',
    names: ['Microsoft', 'Microsoft Corporation', 'Microsoft Corp', 'Microsoft Inc', 'MSFT', 'Microsoft Ltd', 'Microsft'],
  },
  {
    id: 'apple',
    entityLabel: 'Apple',
    names: ['Apple Inc', 'Apple', 'Apple Inc.', 'Apple Computer', 'Apple Corp', 'Apple Ltd', 'AAPL', 'Aple Inc'],
  },
  {
    id: 'walmart',
    entityLabel: 'Walmart',
    names: ['Walmart', 'Walmart Inc', 'Walmart Stores', 'Walmart Corp', 'Walmart Ltd', 'Walmart Supercenter', 'Wal-Mart', 'Walmrt'],
  },
  {
    id: 'target',
    entityLabel: 'Target',
    names: ['Target Corporation', 'Target', 'Target Corp', 'Target Inc', 'Target Ltd', 'Target Stores', 'Targe Corp'],
  },
  {
    id: 'ford',
    entityLabel: 'Ford',
    names: ['Ford Motor Company', 'Ford', 'Ford Motor', 'Ford Motor Co', 'Ford Inc', 'Ford Ltd', 'Ford Moter'],
  },
  {
    id: 'disney',
    entityLabel: 'Disney',
    names: ['The Walt Disney Company', 'Disney', 'Walt Disney', 'Disney Inc', 'Disney Co', 'Walt Disney Co', 'Disney Ltd'],
  },
  {
    id: 'netflix',
    entityLabel: 'Netflix',
    names: ['Netflix', 'Netflix Inc', 'Netflix LLC', 'Netflix Ltd', 'Netflix Inc.', 'Netflix Streaming', 'Netflx'],
  },
]

const CONTACTS_PER_COMPANY = 1000
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

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateContact(companyName, entityLabel, index, companyId) {
  const first = pick(FIRST_NAMES)
  const last = pick(LAST_NAMES)
  const name = `${first} ${last}`
  const email = `${first.toLowerCase()}.${last.toLowerCase()}.${index}@${companyId}.demo.com`
  const phone = `+1-555-${String(Math.floor(Math.random() * 900) + 100)}-${String(Math.floor(Math.random() * 9000) + 1000)}`
  const region = pick(REGIONS)
  return { Name: name, Email: email, Company: companyName, Phone: phone, Region: region, Entity: entityLabel }
}

function escapeCsvCell(s) {
  const str = String(s ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function main() {
  const rows = []
  const headers = ['Name', 'Email', 'Company', 'Phone', 'Region', 'Entity']
  rows.push(headers.map(escapeCsvCell).join(','))

  for (const company of COMPANIES) {
    const names = company.names
    const entityLabel = company.entityLabel
    for (let i = 0; i < CONTACTS_PER_COMPANY; i++) {
      const companyName = names[i % names.length]
      const contact = generateContact(companyName, entityLabel, i, company.id)
      rows.push(headers.map((h) => escapeCsvCell(contact[h])).join(','))
    }
  }

  const csv = rows.join('\n')
  const outDir = path.join(__dirname, '..', 'public')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'demo-contacts-25k.csv')
  fs.writeFileSync(outPath, csv, 'utf8')
  console.log(`Wrote ${rows.length - 1} contacts to ${outPath}`)
}

main()
