/**
 * @file matcherKeybookCoverage.test.ts
 */
import { describe, expect, it } from 'vitest'
import { computeMatcherKeybookCoverage } from './matcherKeybookCoverage'
import type { MatcherKeybookSnapshot } from '../api/matcherKeybook'

describe('computeMatcherKeybookCoverage', () => {
  it('counts parents for canonical names and contact raws', () => {
    const snapshot: MatcherKeybookSnapshot = {
      companyKey: [
        { name: 'A', parentCompany: 'Pa' },
        { name: 'B', parentCompany: '' },
      ],
      contactCompanyKey: [{ raw: 'r1', parentCompany: 'P1' }],
      contactCompanyMatch: [],
    }
    const cov = computeMatcherKeybookCoverage(snapshot, ['A', 'B', 'C'], ['r1', 'r2'])
    expect(cov).toEqual({
      companyKeyWithParent: 1,
      companyKeyTotal: 3,
      contactKeyWithParent: 1,
      contactKeyTotal: 2,
    })
  })

  it('returns null when snapshot is null', () => {
    expect(computeMatcherKeybookCoverage(null, ['A'], ['r'])).toBeNull()
  })
})
