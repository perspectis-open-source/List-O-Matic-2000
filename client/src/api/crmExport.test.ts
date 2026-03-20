/**
 * @file crmExport.test.ts
 * @description Vitest unit tests for CRM export API client: fetchCrmEnabled and postCrmExport.
 * @module List-O-Matic-2000/client
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchCrmEnabled, postCrmExport } from './crmExport'

describe('fetchCrmEnabled', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns true when /api/crm/status responds with enabled: true', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ enabled: true }),
    } as Response)

    expect(await fetchCrmEnabled()).toBe(true)
  })

  it('returns false when /api/crm/status responds with enabled: false', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ enabled: false }),
    } as Response)

    expect(await fetchCrmEnabled()).toBe(false)
  })

  it('returns false when response omits enabled field', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    } as Response)

    expect(await fetchCrmEnabled()).toBe(false)
  })

  it('returns false on HTTP error (fail-closed)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response)

    expect(await fetchCrmEnabled()).toBe(false)
  })

  it('returns false on network error (fail-closed)', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('fetch failed'))

    expect(await fetchCrmEnabled()).toBe(false)
  })
})

describe('postCrmExport', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends POST to /api/crm/export with correct body', async () => {
    const mockFetch = vi.mocked(fetch)
    const mockResponse = { totalSent: 1, created: 1, updated: 0, failed: 0, errors: [] }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response)

    const request = {
      contacts: [{ Email: 'a@b.com', Name: 'Alice' }],
      fieldMapping: { Email: 'email', Name: 'full_name' },
    }
    const result = await postCrmExport(request)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toMatch(/\/api\/crm\/export$/)
    expect(options?.method).toBe('POST')
    const body = JSON.parse((options?.body as string) ?? '{}')
    expect(body.contacts).toEqual(request.contacts)
    expect(body.fieldMapping).toEqual(request.fieldMapping)
    expect(result).toEqual(mockResponse)
  })

  it('throws with server error message on 400', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'contacts must be a non-empty array' }),
    } as Response)

    await expect(
      postCrmExport({ contacts: [], fieldMapping: { Email: 'email' } })
    ).rejects.toThrow('contacts must be a non-empty array')
  })

  it('throws with server error message on 503', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: 'CRM export is not configured' }),
    } as Response)

    await expect(
      postCrmExport({ contacts: [{ Email: 'a@b.com' }], fieldMapping: { Email: 'email' } })
    ).rejects.toThrow('CRM export is not configured')
  })

  it('throws generic message when error body is not JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    } as Response)

    await expect(
      postCrmExport({ contacts: [{ Email: 'a@b.com' }], fieldMapping: { Email: 'email' } })
    ).rejects.toThrow('Request failed: 500')
  })

  it('throws on network failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('fetch failed'))

    await expect(
      postCrmExport({ contacts: [{ Email: 'a@b.com' }], fieldMapping: { Email: 'email' } })
    ).rejects.toThrow('fetch failed')
  })
})
