/**
 * @file openaiPricing.test.ts
 */
import { describe, expect, it } from 'vitest'
import { estimateOpenAiChatCostUsd, normalizeOpenAiModelId } from './openaiPricing'

describe('openaiPricing', () => {
  it('normalizes dated gpt-4o-mini ids', () => {
    expect(normalizeOpenAiModelId('gpt-4o-mini-2024-07-18')).toBe('gpt-4o-mini')
  })

  it('estimates gpt-4o-mini cost from token counts', () => {
    // 1M in @ $0.15 + 0.5M out @ $0.60 = 0.15 + 0.30 = 0.45
    expect(estimateOpenAiChatCostUsd('gpt-4o-mini', 1_000_000, 500_000)).toBeCloseTo(0.45, 5)
    expect(estimateOpenAiChatCostUsd('gpt-4o-mini-2024-07-18', 1_000_000, 500_000)).toBeCloseTo(0.45, 5)
  })

  it('returns null for unknown models', () => {
    expect(estimateOpenAiChatCostUsd('gpt-5-future', 100, 100)).toBeNull()
  })
})
