/**
 * @file chat.test.ts
 * @description Vitest unit tests for postChat API client.
 * @module List-O-Matic-2000/client
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { postChat } from './chat'

describe('postChat', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends POST to /api/chat with messages and uniqueCompanyNames', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          matchingCompanyNames: ['Acme Inc'],
          parentCompany: 'Acme Corp',
        }),
    } as Response)

    const result = await postChat(
      [{ role: 'user', content: 'Find Acme' }],
      ['Acme Inc', 'Acme LLC']
    )

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toMatch(/\/api\/chat$/)
    expect(options?.method).toBe('POST')
    const body = JSON.parse((options?.body as string) ?? '{}')
    expect(body.messages).toEqual([{ role: 'user', content: 'Find Acme' }])
    expect(body.uniqueCompanyNames).toEqual(['Acme Inc', 'Acme LLC'])
    expect(result.matchingCompanyNames).toEqual(['Acme Inc'])
    expect(result.parentCompany).toBe('Acme Corp')
  })

  it('throws when response is not ok', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Server error' }),
    } as Response)

    await expect(
      postChat([{ role: 'user', content: 'x' }], ['A'])
    ).rejects.toThrow('Server error')
  })
})
