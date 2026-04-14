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
} from './companyMatch'
import type { CompanyRow } from './parseFile'

describe('normalizeForMatch', () => {
  it('lowercases and collapses spaces', () => {
    expect(normalizeForMatch('  Acme  Inc ')).toBe('acme inc')
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

describe('pickMatchedCompanyHeader', () => {
  it('returns base when free', () => {
    expect(pickMatchedCompanyHeader(['Company'])).toBe('Matched Company')
  })
  it('uses suffix when base taken', () => {
    expect(pickMatchedCompanyHeader(['Matched Company'])).toBe('Matched Company 2')
  })
})
