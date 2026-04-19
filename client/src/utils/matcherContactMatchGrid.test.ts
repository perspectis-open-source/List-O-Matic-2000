/**
 * @file matcherContactMatchGrid.test.ts
 */
import { describe, expect, it } from 'vitest'
import { buildMatchKeyGridRows } from './matcherContactMatchGrid'
import type { MatcherKeybookContactMatchRow } from '../api/matcherKeybook'

describe('buildMatchKeyGridRows', () => {
  it('fills crmCompany from companies Name with canonical casing', () => {
    const rows: MatcherKeybookContactMatchRow[] = [
      { contactCompany: 'coke', matchedCompany: 'coca-cola company', parentCompany: 'Parent' },
    ]
    const companies = [{ Name: 'Coca-Cola Company', 'Client Number': '1' }]
    const out = buildMatchKeyGridRows(rows, companies)
    expect(out[0].crmCompany).toBe('Coca-Cola Company')
    expect(out[0].matchedCompany).toBe('coca-cola company')
  })

  it('prefers CRM Company column when set', () => {
    const rows: MatcherKeybookContactMatchRow[] = [
      { contactCompany: 'x', matchedCompany: 'Acme Inc', parentCompany: '' },
    ]
    const companies = [{ Name: 'Acme Inc', 'CRM Company': 'ACME HOLDINGS' }]
    const out = buildMatchKeyGridRows(rows, companies)
    expect(out[0].crmCompany).toBe('ACME HOLDINGS')
  })

  it('leaves crmCompany empty when there is no match', () => {
    const rows: MatcherKeybookContactMatchRow[] = [
      { contactCompany: 'orphan', matchedCompany: '', parentCompany: '' },
    ]
    expect(buildMatchKeyGridRows(rows, [{ Name: 'Other' }])[0].crmCompany).toBe('')
  })
})
