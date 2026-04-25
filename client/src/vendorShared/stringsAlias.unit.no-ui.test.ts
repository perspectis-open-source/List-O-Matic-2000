/**
 * @file stringsAlias.unit.no-ui.test.ts
 * @description Ensures local standalone string helpers resolve for Vitest.
 */
import { describe, it, expect } from 'vitest'
import { coerceTrimmed, isNonEmptyCoercedTrimmed } from '../platform/local/shared/lib/strings'

describe('local/shared/lib/strings', () => {
  it('coerceTrimmed trims and stringifies', () => {
    expect(coerceTrimmed('  x  ')).toBe('x')
    expect(coerceTrimmed(null)).toBe('')
  })

  it('isNonEmptyCoercedTrimmed', () => {
    expect(isNonEmptyCoercedTrimmed('a')).toBe(true)
    expect(isNonEmptyCoercedTrimmed('  ')).toBe(false)
  })
})
