import { describe, it, expect } from 'vitest'
import { parseBatchLinePrefix, batchProgressBlue } from './highlight'

describe('parseBatchLinePrefix', () => {
  it('parses batch prefix', () => {
    expect(parseBatchLinePrefix('Batch 2/5: Tokens this request: 100')).toEqual({
      batchIndex: 2,
      batchTotal: 5,
      tail: 'Tokens this request: 100',
    })
  })

  it('returns null when no match', () => {
    expect(parseBatchLinePrefix('no batch here')).toBeNull()
  })
})

describe('batchProgressBlue', () => {
  it('returns a hex color', () => {
    const c = batchProgressBlue(1, 3, '#1e40af', 'light')
    expect(c).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
