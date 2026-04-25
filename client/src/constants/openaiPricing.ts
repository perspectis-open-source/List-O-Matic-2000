/**
 * Local OpenAI list pricing helpers used by matcher UI.
 */
import {
  DEFAULT_OPENAI_CHAT_MODEL_ID,
  estimateOpenAiChatCostUsd,
  formatUsdEstimate,
  normalizeOpenAiModelId,
} from '../platform/local/shared/openaiListPricing'

export {
  DEFAULT_OPENAI_CHAT_MODEL_ID,
  estimateOpenAiChatCostUsd,
  formatUsdEstimate,
  normalizeOpenAiModelId,
}

/** Default model id for match-companies cost estimates in this app (same as server default). */
export const MATCH_COMPANIES_OPENAI_MODEL = DEFAULT_OPENAI_CHAT_MODEL_ID
