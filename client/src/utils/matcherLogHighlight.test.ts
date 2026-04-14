/**
 * @file matcherLogHighlight.test.ts
 */
import { describe, expect, it } from 'vitest'
import { batchProgressBlue, parseBatchLinePrefix } from './matcherLogHighlight'

describe('parseBatchLinePrefix', () => {
  it('parses batch line rest and tail', () => {
    const p = parseBatchLinePrefix('Batch 2/6: sending 30 string(s)…')
    expect(p).toEqual({
      batchIndex: 2,
      batchTotal: 6,
      tail: 'sending 30 string(s)…',
    })
  })

  it('returns null when no batch prefix', () => {
    expect(parseBatchLinePrefix('Starting model pass: 5 unique')).toBeNull()
    expect(parseBatchLinePrefix('Batch 1/6')).toBeNull()
  })
})

describe('batchProgressBlue', () => {
  const tokens = '#1e40af'

  it('ramps from light blue at batch 1 to tokens color at last batch', () => {
    expect(batchProgressBlue(1, 4, tokens, 'light').toLowerCase()).toBe('#38bdf8')
    expect(batchProgressBlue(4, 4, tokens, 'light').toLowerCase()).toBe(tokens)
  })

  it('uses ramp start when only one batch (ratio 0)', () => {
    expect(batchProgressBlue(1, 1, tokens, 'light').toLowerCase()).toBe('#38bdf8')
  })
})
