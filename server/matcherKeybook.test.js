/**
 * @file matcherKeybook.test.js
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

describe('matcherKeybook', () => {
  let tmpDir

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'keybook-test-'))
    process.env.MATCHER_KEYBOOK_DIR = tmpDir
    vi.resetModules()
  })

  afterEach(async () => {
    delete process.env.MATCHER_KEYBOOK_DIR
    await fs.rm(tmpDir, { recursive: true, force: true })
    vi.resetModules()
  })

  it('readCompanyKeybook returns empty map for missing file', async () => {
    const kb = await import('./matcherKeybook.js')
    const m = await kb.readCompanyKeybook()
    expect(m.size).toBe(0)
  })

  it('persistNewCanonParents merges and readCompanyKeybook skips invalid lines', async () => {
    const kb = await import('./matcherKeybook.js')
    const file = path.join(tmpDir, kb.COMPANY_KEY_JSONL)
    await fs.writeFile(
      file,
      '{"name":"Acme","parentCompany":"Old"}\nnot json\n{"name":"Beta","parentCompany":"B"}\n',
      'utf8',
    )
    let m = await kb.readCompanyKeybook()
    expect(m.get('Acme')).toBe('Old')
    expect(m.get('Beta')).toBe('B')
    await kb.persistNewCanonParents([
      { name: 'Acme', parentCompany: 'New Parent' },
      { name: 'Gamma', parentCompany: 'G' },
    ])
    m = await kb.readCompanyKeybook()
    expect(m.get('Acme')).toBe('New Parent')
    expect(m.get('Beta')).toBe('B')
    expect(m.get('Gamma')).toBe('G')
  })

  it('persistNewContactParents merges by raw', async () => {
    const kb = await import('./matcherKeybook.js')
    await kb.persistNewContactParents([{ raw: 'r1', parentCompany: 'P1' }])
    let m = await kb.readContactKeybook()
    expect(m.get('r1')).toBe('P1')
    await kb.persistNewContactParents([{ raw: 'r2', parentCompany: 'P2' }])
    m = await kb.readContactKeybook()
    expect(m.get('r1')).toBe('P1')
    expect(m.get('r2')).toBe('P2')
  })

  it('skips empty name or parent on persist', async () => {
    const kb = await import('./matcherKeybook.js')
    await kb.persistNewCanonParents([{ name: '', parentCompany: 'X' }, { name: 'A', parentCompany: '' }])
    const m = await kb.readCompanyKeybook()
    expect(m.size).toBe(0)
  })

  it('persistContactMatches merges by raw and readContactMatchbook parses null match', async () => {
    const kb = await import('./matcherKeybook.js')
    await kb.persistContactMatches([
      { raw: 'A Inc', match: 'A Corp', parentCompany: 'HoldCo' },
      { raw: 'Beta', match: null, parentCompany: 'B Parent' },
    ])
    let m = await kb.readContactMatchbook()
    expect(m.get('A Inc')).toEqual({ match: 'A Corp', parentCompany: 'HoldCo' })
    expect(m.get('Beta')).toEqual({ match: null, parentCompany: 'B Parent' })
    await kb.persistContactMatches([{ raw: 'A Inc', match: 'A Corp', parentCompany: 'NewHold' }])
    m = await kb.readContactMatchbook()
    expect(m.get('A Inc')).toEqual({ match: 'A Corp', parentCompany: 'NewHold' })
    expect(m.get('Beta')).toEqual({ match: null, parentCompany: 'B Parent' })
  })

  it('seedParentByRawFromKeybooks uses match keybook when contact key missing', async () => {
    const kb = await import('./matcherKeybook.js')
    const keyRaw = new Map()
    const keyMatch = new Map([['rawA', { match: 'N1', parentCompany: 'FromMatch' }]])
    const { parentByRaw, backfillContactKey } = kb.seedParentByRawFromKeybooks([{ raw: 'rawA' }], keyRaw, keyMatch)
    expect(parentByRaw.get('rawA')).toBe('FromMatch')
    expect(backfillContactKey).toEqual([{ raw: 'rawA', parentCompany: 'FromMatch' }])
  })

  it('shouldRunMatchFallbackForRaw skips stored no-match when contact has inferred parent', async () => {
    const kb = await import('./matcherKeybook.js')
    const byRaw = new Map([['r1', { raw: 'r1', match: null, alternates: [] }]])
    const parentByRaw = new Map([['r1', 'SomeParent']])
    const keyMatch = new Map([['r1', { match: null, parentCompany: 'SomeParent' }]])
    expect(kb.shouldRunMatchFallbackForRaw('r1', byRaw, parentByRaw, keyMatch)).toBe(false)
  })

  it('shouldRunMatchFallbackForRaw runs when contact has no parent even if keybook has null match', async () => {
    const kb = await import('./matcherKeybook.js')
    const byRaw = new Map([['r1', { raw: 'r1', match: null, alternates: [] }]])
    const parentByRaw = new Map([['r1', '']])
    const keyMatch = new Map([['r1', { match: null, parentCompany: '' }]])
    expect(kb.shouldRunMatchFallbackForRaw('r1', byRaw, parentByRaw, keyMatch)).toBe(true)
  })

  it('shouldRunMatchFallbackForRaw runs when no keybook row and has parent', async () => {
    const kb = await import('./matcherKeybook.js')
    const byRaw = new Map([['r1', { raw: 'r1', match: null, alternates: [] }]])
    const parentByRaw = new Map([['r1', 'P']])
    const keyMatch = new Map()
    expect(kb.shouldRunMatchFallbackForRaw('r1', byRaw, parentByRaw, keyMatch)).toBe(true)
  })

  it('shouldRunMatchFallbackForRaw runs when keybook has non-empty match not yet applied', async () => {
    const kb = await import('./matcherKeybook.js')
    const byRaw = new Map([['r1', { raw: 'r1', match: null, alternates: [] }]])
    const parentByRaw = new Map([['r1', 'P']])
    const keyMatch = new Map([['r1', { match: 'Acme', parentCompany: 'P' }]])
    expect(kb.shouldRunMatchFallbackForRaw('r1', byRaw, parentByRaw, keyMatch)).toBe(true)
  })

  it('seedParentByRawFromKeybooks prefers contact key over match', async () => {
    const kb = await import('./matcherKeybook.js')
    const keyRaw = new Map([['rawA', 'FromContact']])
    const keyMatch = new Map([['rawA', { match: null, parentCompany: 'FromMatch' }]])
    const { parentByRaw, backfillContactKey } = kb.seedParentByRawFromKeybooks([{ raw: 'rawA' }], keyRaw, keyMatch)
    expect(parentByRaw.get('rawA')).toBe('FromContact')
    expect(backfillContactKey.length).toBe(0)
  })

  it('getMatcherKeybookSnapshot includes contactCompanyMatch', async () => {
    const kb = await import('./matcherKeybook.js')
    await kb.persistNewCanonParents([{ name: 'N1', parentCompany: 'P1' }])
    await kb.persistNewContactParents([{ raw: 'r1', parentCompany: 'cp' }])
    await kb.persistContactMatches([{ raw: 'r1', match: 'N1', parentCompany: 'cp' }])
    const snap = await kb.getMatcherKeybookSnapshot()
    expect(snap.companyKey.some((r) => r.name === 'N1' && r.parentCompany === 'P1')).toBe(true)
    expect(snap.contactCompanyKey.some((r) => r.raw === 'r1' && r.parentCompany === 'cp')).toBe(true)
    expect(
      snap.contactCompanyMatch.some(
        (r) => r.contactCompany === 'r1' && r.matchedCompany === 'N1' && r.parentCompany === 'cp',
      ),
    ).toBe(true)
  })
})
