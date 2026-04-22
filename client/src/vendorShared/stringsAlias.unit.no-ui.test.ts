/**
 * @file stringsAlias.unit.no-ui.test.ts
 * @description Ensures `@vendor-shared` path alias resolves for Vitest (same as Vite).
 */
import { describe, it, expect } from 'vitest'
import { coerceTrimmed, isNonEmptyCoercedTrimmed } from '@vendor-shared/lib/strings'

describe('@vendor-shared/lib/strings', () => {
  it('coerceTrimmed trims and stringifies', () => {
    expect(coerceTrimmed('  x  ')).toBe('x')
    expect(coerceTrimmed(null)).toBe('')
  })

  it('isNonEmptyCoercedTrimmed', () => {
    expect(isNonEmptyCoercedTrimmed('a')).toBe(true)
    expect(isNonEmptyCoercedTrimmed('  ')).toBe(false)
  })
})
