/**
 * Estimated USD cost from token usage using OpenAI's published rates (standard API, non-batch).
 * Re-check periodically: https://platform.openai.com/docs/pricing
 */

export const DEFAULT_OPENAI_CHAT_MODEL_ID = 'gpt-4o-mini'

type ModelRates = { inputPer1M: number; outputPer1M: number }

const RATES_BY_NORMALIZED_ID: Record<string, ModelRates> = {
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
}

export function normalizeOpenAiModelId(model: string): string {
  const m = model.trim().toLowerCase()
  if (m.startsWith('gpt-4o-mini')) return 'gpt-4o-mini'
  return m
}

export function estimateOpenAiChatCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number | null {
  const key = normalizeOpenAiModelId(model)
  const r = RATES_BY_NORMALIZED_ID[key]
  if (!r) return null
  return (promptTokens / 1_000_000) * r.inputPer1M + (completionTokens / 1_000_000) * r.outputPer1M
}

export function formatUsdEstimate(usd: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(usd)
}
