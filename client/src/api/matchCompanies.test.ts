/**
 * @file matchCompanies.test.ts
 * @description Tests for match-companies client API.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { postMatchCompanies, postMatchCompaniesBatched } from './matchCompanies'

describe('postMatchCompanies', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs body and returns results', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ raw: 'A', match: 'B', alternates: [] }] }),
    } as Response)

    const out = await postMatchCompanies(['B'], [{ raw: 'A', topCandidates: ['B'] }])
    expect(out.results).toHaveLength(1)
    expect(out.results[0].match).toBe('B')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/match-companies'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('throws on error response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'bad' }),
    } as Response)
    await expect(postMatchCompanies([], [])).rejects.toThrow('bad')
  })
})

describe('postMatchCompaniesBatched', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns empty array when no items', async () => {
    const out = await postMatchCompaniesBatched(['x'], [])
    expect(out).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })
})
