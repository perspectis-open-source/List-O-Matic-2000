/**
 * @file parseFile.test.ts
 * @description Vitest unit tests for parseFile (column detection, validation, parseContactFile, parseCompanyFile).
 * @module List-O-Matic-2000/client
 */
import { describe, it, expect } from 'vitest'
import {
  detectCompanyColumnKey,
  detectEntityColumnKey,
  parseCSV,
  parseContactFile,
  parseCompanyFile,
  validateNoBlankOrDuplicateHeaders,
  classifyContactHeaders,
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

describe('validateNoBlankOrDuplicateHeaders', () => {
  it('throws on duplicate', () => {
    expect(() => validateNoBlankOrDuplicateHeaders(['A', 'A'])).toThrow(/duplicate/)
  })

  it('throws on empty header', () => {
    expect(() => validateNoBlankOrDuplicateHeaders(['A', ''])).toThrow(/empty/)
  })
})

describe('classifyContactHeaders', () => {
  it('returns new when all nine columns present once', () => {
    expect(
      classifyContactHeaders([
        'First',
        'Last',
        'Company',
        'Title',
        'Email',
        'City',
        'State',
        'Zip',
        'Country',
      ])
    ).toBe('new')
  })

  it('prefers new when all nine present with extras', () => {
    expect(
      classifyContactHeaders([
        'First',
        'Last',
        'Company',
        'Title',
        'Email',
        'City',
        'State',
        'Zip',
        'Country',
        'ExtraCol',
      ])
    ).toBe('new')
  })

  it('returns legacy when Name Email Company present once', () => {
    expect(classifyContactHeaders(['Name', 'Email', 'Company'])).toBe('legacy')
  })

  it('throws on neither and hints companies when company shape', () => {
    expect(() =>
      classifyContactHeaders([
        'Name',
        'Client Number',
        'Open Date',
        'Status',
        'Client Originating Attorney',
      ])
    ).toThrow(/companies import/)
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

describe('classifyContactHeaders duplicate columns', () => {
  it('rejects duplicate required names', () => {
    expect(() => classifyContactHeaders(['Name', 'Name', 'Email', 'Company'])).toThrow(/duplicate/)
  })
})

describe('parseContactFile', () => {
  it('parses legacy CSV and detects company column', async () => {
    const csv = 'Name,Company,Email\nAlice,Acme Inc,alice@test.com'
    const file = new File([csv], 'contacts.csv', { type: 'text/csv' })
    const result = await parseContactFile(file)
    expect(result.headers).toEqual(['Name', 'Company', 'Email'])
    expect(result.data).toHaveLength(1)
    expect(result.companyColumnKey).toBe('Company')
    expect(result.entityColumnKey).toBeNull()
    expect(result.contactSchemaKind).toBe('legacy')
  })

  it('parses new nine-column CSV', async () => {
    const cols =
      'First,Last,Company,Title,Email,City,State,Zip,Country\n' +
      'Jane,Doe,Acme Inc,VP,jane@acme.com,Boston,MA,02101,USA'
    const file = new File([cols], 'contacts.csv', { type: 'text/csv' })
    const result = await parseContactFile(file)
    expect(result.contactSchemaKind).toBe('new')
    expect(result.companyColumnKey).toBe('Company')
    expect(result.data[0].Company).toBe('Acme Inc')
  })
})

describe('parseCompanyFile', () => {
  it('accepts valid company CSV', async () => {
    const csv =
      'Name,Client Number,Open Date,Status,Client Originating Attorney\n' +
      'Acme LLC,1001,2020-01-15,Active,J. Smith'
    const file = new File([csv], 'companies.csv', { type: 'text/csv' })
    const result = await parseCompanyFile(file)
    expect(result.data).toHaveLength(1)
    expect(result.headers).toContain('Client Number')
  })

  it('rejects contacts file with hint', async () => {
    const csv = 'Name,Email,Company\nA,a@b.com,X'
    const file = new File([csv], 'wrong.csv', { type: 'text/csv' })
    await expect(parseCompanyFile(file)).rejects.toThrow(/contacts import/)
  })
})
