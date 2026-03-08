/**
 * @file parseFile.test.ts
 * @description Vitest unit tests for parseFile (column detection, parseCSV, parseContactFile).
 * @module List-O-Matic-2000/client
 */
import { describe, it, expect } from 'vitest'
import {
  detectCompanyColumnKey,
  detectEntityColumnKey,
  parseCSV,
  parseContactFile,
} from './parseFile'

describe('detectCompanyColumnKey', () => {
  it('returns "Company" when present', () => {
    expect(detectCompanyColumnKey(['Name', 'Company', 'Email'])).toBe('Company')
  })

  it('returns "company" when present and "Company" is not', () => {
    expect(detectCompanyColumnKey(['name', 'company'])).toBe('company')
  })

  it('returns "Organization" when present', () => {
    expect(detectCompanyColumnKey(['Organization'])).toBe('Organization')
  })

  it('returns null when no company-like column exists', () => {
    expect(detectCompanyColumnKey(['Name', 'Email', 'Phone'])).toBeNull()
    expect(detectCompanyColumnKey([])).toBeNull()
  })
})

describe('detectEntityColumnKey', () => {
  it('returns "Entity" when present', () => {
    expect(detectEntityColumnKey(['Company', 'Entity'])).toBe('Entity')
  })

  it('returns null when no entity-like column exists', () => {
    expect(detectEntityColumnKey(['Name', 'Company'])).toBeNull()
  })
})

describe('parseCSV', () => {
  it('parses a simple CSV and returns data and headers', async () => {
    const csv = 'Name,Email,Company\nAlice,alice@test.com,Acme\nBob,bob@test.com,Globex'
    const file = new File([csv], 'test.csv', { type: 'text/csv' })
    const { data, headers } = await parseCSV(file)
    expect(headers).toEqual(['Name', 'Email', 'Company'])
    expect(data).toHaveLength(2)
    expect(data[0]).toEqual({ Name: 'Alice', Email: 'alice@test.com', Company: 'Acme' })
    expect(data[1]).toEqual({ Name: 'Bob', Email: 'bob@test.com', Company: 'Globex' })
  })
})

describe('parseContactFile', () => {
  it('parses CSV and detects company column', async () => {
    const csv = 'Name,Company,Email\nAlice,Acme Inc,alice@test.com'
    const file = new File([csv], 'contacts.csv', { type: 'text/csv' })
    const result = await parseContactFile(file)
    expect(result.headers).toEqual(['Name', 'Company', 'Email'])
    expect(result.data).toHaveLength(1)
    expect(result.companyColumnKey).toBe('Company')
    expect(result.entityColumnKey).toBeNull()
  })
})
