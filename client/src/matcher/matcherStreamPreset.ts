import {
  DEFAULT_OPENAI_CHAT_MODEL_ID,
  estimateOpenAiChatCostUsd,
  formatUsdEstimate,
} from '../platform/local/shared/openaiListPricing'
import type { MatcherActivityLogSetter, MatcherLlmProgress, MatcherServerStreamProgress } from './matcherStreamTypes'

export function applyMatcherStreamProgress(
  prev: MatcherLlmProgress | null,
  ev: MatcherServerStreamProgress,
  fallbackBatchTotal: number,
): MatcherLlmProgress {
  if (ev.phase === 'llm_call') {
    if (!prev) return { completed: 0, total: fallbackBatchTotal, server: {} }
    return { completed: prev.completed, total: prev.total, server: { ...prev.server } }
  }
  const base: MatcherLlmProgress = prev ?? { completed: 0, total: fallbackBatchTotal }
  const server = { ...base.server }
  if (ev.phase === 'step1') {
    server.step1 = {
      completed: ev.completed ?? 0,
      total: ev.total ?? 1,
      cached: ev.cached,
    }
  }
  if (ev.phase === 'step2') {
    server.step2 = { completed: ev.completed ?? 0, total: ev.total ?? 1 }
  }
  if (ev.phase === 'step3') {
    server.step3 = { done: true, detail: ev.detail }
  }
  if (ev.phase === 'fallback') {
    server.fallback = { completed: ev.completed ?? 0, total: ev.total ?? 1 }
  }
  return { completed: base.completed, total: base.total, server }
}

/**
 * Append one timestamped matcher log line. Keeps the last `maxKeep` entries.
 */
export function appendMatcherActivityLogEntry(
  setLog: MatcherActivityLogSetter,
  line: string,
  correlationId?: string,
  maxKeep = 200,
): void {
  const ts = new Date().toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  setLog((prev) => [...prev.slice(-(maxKeep - 1)), { line: `[${ts}] ${line}`, correlationId }])
}

export function logMatcherLlmCallProgress(
  push: (line: string, correlationId?: string) => void,
  ev: MatcherServerStreamProgress,
): void {
  if (ev.phase !== 'llm_call') return
  if (!ev.usage && typeof ev.durationMs !== 'number') return
  const modelId = ev.model?.trim() || DEFAULT_OPENAI_CHAT_MODEL_ID
  const durPart =
    typeof ev.durationMs === 'number'
      ? ev.durationMs >= 1000
        ? `${(ev.durationMs / 1000).toFixed(1)} s`
        : `${ev.durationMs} ms`
      : ''
  const ord = typeof ev.callOrdinal === 'number' ? `#${ev.callOrdinal} ` : ''
  const u = ev.usage
  let tok = ''
  if (u != null && u.totalTokens > 0) {
    const est = estimateOpenAiChatCostUsd(modelId, u.promptTokens, u.completionTokens)
    const estPart =
      est != null
        ? ` Est. ${formatUsdEstimate(est)} (${modelId}; OpenAI standard list prices, approximate).`
        : ` Cannot estimate USD (no rate table for ${modelId}).`
    tok = ` Tokens: ${u.totalTokens.toLocaleString()} (in ${u.promptTokens.toLocaleString()} / out ${u.completionTokens.toLocaleString()}).${estPart}`
  } else if (u != null) {
    tok = ` Tokens: ${u.totalTokens} (in ${u.promptTokens} / out ${u.completionTokens}).`
  }
  const head = `${ord}${ev.stepName ?? 'llm_call'}`
  const mid = durPart ? `${durPart}; ${modelId}` : modelId
  const cid = typeof ev.correlationId === 'string' && ev.correlationId.trim() ? ev.correlationId.trim() : undefined
  push(`${head} — ${mid}.${tok}`, cid)
}
