/**
 * @description Ensures the client re-export still resolves pricing helpers (implementation lives in `@vendor-shared`).
 */
import { describe, expect, it } from 'vitest'
import { estimateOpenAiChatCostUsd, normalizeOpenAiModelId } from './openaiPricing'

describe('openaiPricing re-export', () => {
  it('delegates to shared implementation', () => {
    expect(normalizeOpenAiModelId('gpt-4o-mini-2024-07-18')).toBe('gpt-4o-mini')
    expect(estimateOpenAiChatCostUsd('gpt-4o-mini', 1_000_000, 500_000)).toBeCloseTo(0.45, 5)
  })
})
