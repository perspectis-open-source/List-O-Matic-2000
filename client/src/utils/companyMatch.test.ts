/**
 * @file companyMatch.test.ts
 * @description Unit tests for deterministic company matching utilities.
 */
import { describe, it, expect } from 'vitest'
import {
  normalizeForMatch,
  jaroWinkler,
  canonicalNamesFromCompanies,
  matchDeterministicBatch,
  pickMatchedCompanyHeader,
  tierFromScores,
  stripTrailingLegalSuffixForMatch,
  buildMatcherTableExport,
  MATCHER_TABLE_EXPORT_MATCH_HEADER,
} from './companyMatch'
import type { CompanyRow } from './parseFile'

describe('normalizeForMatch', () => {
  it('lowercases and collapses spaces', () => {
    expect(normalizeForMatch('  Acme  Inc ')).toBe('acme inc')
  })
})

describe('stripTrailingLegalSuffixForMatch', () => {
  it('strips ltd / inc / corp style suffixes from normalized strings', () => {
    expect(stripTrailingLegalSuffixForMatch('apple ltd')).toBe('apple')
    expect(stripTrailingLegalSuffixForMatch('apple inc.')).toBe('apple')
    expect(stripTrailingLegalSuffixForMatch('acme corp')).toBe('acme')
    expect(stripTrailingLegalSuffixForMatch('widgets limited')).toBe('widgets')
  })
  it('strips repeatedly for chained suffixes', () => {
    expect(stripTrailingLegalSuffixForMatch('foo inc. llc')).toBe('foo')
  })
})

describe('legal suffix core matching', () => {
  it('auto-matches Apple Ltd import to Apple Inc. canonical', () => {
    const canon = ['Apple Inc.']
    const rows = matchDeterministicBatch(['Apple Ltd'], canon)
    expect(rows[0].tier).toBe('auto')
    expect(rows[0].best).toBe('Apple Inc.')
    expect(rows[0].bestScore).toBeGreaterThanOrEqual(0.91)
  })

  it('auto-matches Acme Corp to Acme Limited', () => {
    const canon = ['Acme Limited']
    const rows = matchDeterministicBatch(['Acme Corp'], canon)
    expect(rows[0].tier).toBe('auto')
    expect(rows[0].best).toBe('Acme Limited')
  })

  it('does not force a near-1 score for very short shared cores', () => {
    const canon = ['Pi LLC']
    const rows = matchDeterministicBatch(['Pi Inc'], canon)
    expect(rows[0].bestScore).toBeLessThan(0.91)
  })

  it('still separates distinct companies that only share a generic token', () => {
    const canon = ['Northwind Traders Inc', 'Northwind Foods LLC']
    const rows = matchDeterministicBatch(['Northwind Traders Ltd'], canon)
    expect(rows[0].best).toBe('Northwind Traders Inc')
    expect(rows[0].tier).toBe('auto')
  })
})

describe('jaroWinkler', () => {
  it('returns 1 for identical strings', () => {
    expect(jaroWinkler('acme', 'acme')).toBe(1)
  })
  it('is high for close strings', () => {
    expect(jaroWinkler('acme inc', 'acme incorporated')).toBeGreaterThan(0.75)
  })
})

describe('canonicalNamesFromCompanies', () => {
  it('dedupes by case-insensitive Name', () => {
    const rows: CompanyRow[] = [
      { Name: 'Acme Corp', 'Client Number': '1', 'Open Date': '', Status: '', 'Client Originating Attorney': '' },
      { Name: 'acme corp', 'Client Number': '2', 'Open Date': '', Status: '', 'Client Originating Attorney': '' },
    ]
    expect(canonicalNamesFromCompanies(rows)).toEqual(['Acme Corp'])
  })
})

describe('tierFromScores', () => {
  it('marks needs_llm when best is weak', () => {
    expect(tierFromScores([{ name: 'a', score: 0.5 }])).toBe('needs_llm')
  })
})

describe('matchDeterministicBatch', () => {
  it('matches exact canonical', () => {
    const canon = ['Coca-Cola Enterprises']
    const rows = matchDeterministicBatch(['Coca-Cola Enterprises'], canon)
    expect(rows[0].tier).toBe('auto')
    expect(rows[0].best).toBe('Coca-Cola Enterprises')
  })

  it('returns needs_llm when no candidates', () => {
    const rows = matchDeterministicBatch(['Xyz Unknown'], [])
    expect(rows[0].tier).toBe('needs_llm')
  })

  it('keeps long canonicals when the co blocking bucket exceeds the cap (Coke vs Coca-Cola)', () => {
    const fillers = Array.from({ length: 450 }, (_, i) => `Co Zzz Filler ${i} LLC`)
    const canon = ['Cortiva', 'Coca-Cola Company', ...fillers]
    const rows = matchDeterministicBatch(['Coke'], canon)
    expect(rows[0].topCandidates.some((c) => c.name === 'Coca-Cola Company')).toBe(true)
    expect(rows[0].best).toBe('Coca-Cola Company')
  })

  it('prefers Coca-Cola Company over Cooper Companies for Coke', () => {
    const rows = matchDeterministicBatch(['Coke'], ['Cooper Companies', 'Coca-Cola Company'])
    expect(rows[0].best).toBe('Coca-Cola Company')
  })
})

describe('buildMatcherTableExport', () => {
  it('orders columns like the matcher grid and includes import + match', () => {
    const headers = ['Email', 'Company', 'City']
    const contacts: ContactRow[] = [
      { Email: 'a@x.com', Company: 'Acme', City: 'NYC' },
    ]
    const { data, csvHeaders } = buildMatcherTableExport(contacts, headers, 'Company', {
      Acme: 'Acme Holdings',
    })
    expect(csvHeaders).toEqual(['Email', 'Company (import)', MATCHER_TABLE_EXPORT_MATCH_HEADER, 'City'])
    expect(data[0]['Email']).toBe('a@x.com')
    expect(data[0]['Company (import)']).toBe('Acme')
    expect(data[0][MATCHER_TABLE_EXPORT_MATCH_HEADER]).toBe('Acme Holdings')
    expect(data[0].City).toBe('NYC')
  })
})

describe('pickMatchedCompanyHeader', () => {
  it('returns base when free', () => {
    expect(pickMatchedCompanyHeader(['Company'])).toBe('Matched Company')
  })
  it('uses suffix when base taken', () => {
    expect(pickMatchedCompanyHeader(['Matched Company'])).toBe('Matched Company 2')
  })
})
