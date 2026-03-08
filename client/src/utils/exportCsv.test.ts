/**
 * @file exportCsv.test.ts
 * @description Vitest unit tests for exportCsv helpers (sanitizeFilenameSegment, toCsvString, downloadCsv).
 * @module List-O-Matic-2000/client
 */
import { describe, it, expect, vi } from 'vitest'
import { sanitizeFilenameSegment, toCsvString, downloadCsv } from './exportCsv'
import type { ContactRow } from './parseFile'

describe('sanitizeFilenameSegment', () => {
  it('returns segment when safe', () => {
    expect(sanitizeFilenameSegment('Acme Inc')).toBe('Acme Inc')
  })

  it('strips path characters', () => {
    expect(sanitizeFilenameSegment('a/b\\c*d')).not.toMatch(/[/\\*]/)
  })

  it('collapses spaces and trims', () => {
    expect(sanitizeFilenameSegment('  a  b  ')).toBe('a b')
  })

  it('returns "search" for empty or reserved names', () => {
    expect(sanitizeFilenameSegment('')).toBe('search')
    expect(sanitizeFilenameSegment('CON')).toBe('search')
    expect(sanitizeFilenameSegment('nul')).toBe('search')
  })
})

describe('toCsvString', () => {
  it('produces CSV with headers and data', () => {
    const data: ContactRow[] = [
      { Name: 'Alice', Company: 'Acme' },
      { Name: 'Bob', Company: 'Globex' },
    ]
    const headers = ['Name', 'Company']
    const csv = toCsvString(data, headers)
    expect(csv).toContain('Name,Company')
    expect(csv).toContain('Alice,Acme')
    expect(csv).toContain('Bob,Globex')
  })
})

describe('downloadCsv', () => {
  it('does not throw and creates a blob link', () => {
    const createObjectURL = vi.fn(() => 'blob:mock')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const data: ContactRow[] = [{ Name: 'Alice', Company: 'Acme' }]
    const headers = ['Name', 'Company']
    expect(() => downloadCsv(data, headers, 'test.csv')).not.toThrow()
    expect(createObjectURL).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
    vi.unstubAllGlobals()
  })
})
