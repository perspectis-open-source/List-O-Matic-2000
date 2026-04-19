/**
 * @file matcherMatchTooltip.test.ts
 */
import { describe, it, expect } from 'vitest'
import { buildMatcherMatchTooltipText, type MatcherTooltipContext } from './matcherMatchTooltip'

function ctx(partial: Partial<MatcherTooltipContext>): MatcherTooltipContext {
  return {
    selection: {},
    provenanceByRaw: {},
    parentByRaw: {},
    parentByCanon: {},
    ...partial,
  }
}

describe('buildMatcherMatchTooltipText', () => {
  it('says CRM company is … when list Name matches parent label', () => {
    const text = buildMatcherMatchTooltipText('Conagra Corp', {
      selection: { 'Conagra Corp': 'Conagra Brands' },
      provenanceByRaw: { 'Conagra Corp': 'llm' },
      matchExplainByRaw: {
        'Conagra Corp': { source: 'llm' },
      },
      parentByRaw: { 'Conagra Corp': 'Conagra Brands' },
      parentByCanon: { 'Conagra Brands': 'Conagra Brands' },
    })
    expect(text).toBe(
      'Contact company of Conagra Corp mapped to Parent Conagra Brands. CRM company is Conagra Brands, so it matched.',
    )
  })

  it('says CRM of … mapped to … when Name differs but parents align', () => {
    const text = buildMatcherMatchTooltipText('Conagra Corp', {
      selection: { 'Conagra Corp': 'Conagra Inc' },
      provenanceByRaw: { 'Conagra Corp': 'manual' },
      matchExplainByRaw: {
        'Conagra Corp': { source: 'llm' },
      },
      parentByRaw: { 'Conagra Corp': 'Conagra Brands' },
      parentByCanon: { 'Conagra Inc': 'Conagra Brands' },
    })
    expect(text).toBe(
      'Contact company of Conagra Corp mapped to Parent Conagra Brands. CRM of Conagra Inc mapped to Conagra Brands, so it matched.',
    )
  })

  it('covers Fanta / Coke style when CRM Name differs from contact parent string', () => {
    const text = buildMatcherMatchTooltipText('Fanta', {
      selection: { Fanta: 'Coke' },
      provenanceByRaw: { Fanta: 'llm' },
      matchExplainByRaw: { Fanta: { source: 'llm' } },
      parentByRaw: { Fanta: 'Coca-Cola Company' },
      parentByCanon: { Coke: 'Coca-Cola Company' },
    })
    expect(text).toBe(
      'Contact company of Fanta mapped to Parent Coca-Cola Company. CRM of Coke mapped to Coca-Cola Company, so it matched.',
    )
  })

  it('returns skip copy for explicit Skip', () => {
    expect(
      buildMatcherMatchTooltipText('X', {
        selection: { X: '' },
        provenanceByRaw: { X: 'manual' },
        matchExplainByRaw: { X: { source: 'ambiguous' } },
        parentByRaw: {},
        parentByCanon: {},
      }),
    ).toContain('Skip')
  })

  it('asks to run matcher when explain is missing', () => {
    expect(
      buildMatcherMatchTooltipText('X', ctx({ selection: { X: 'Y' } })),
    ).toMatch(/Run the matcher/)
  })
})
