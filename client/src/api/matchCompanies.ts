/**
 * @file matchCompanies.ts
 * @description Client API: POST /api/match-companies — LLM assist for contact company → canonical Name mapping.
 */
import { MATCH_API_BATCH_SIZE } from '../constants/companyMatch'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export type MatchCompanyItem = { raw: string; topCandidates: string[] }

export type MatchCompanyResult = { raw: string; match: string | null; alternates?: string[] }

/** Cumulative token counts from the OpenAI Chat Completions API (one HTTP response may include several model calls). */
export type MatchCompaniesUsageTotals = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type MatchCompaniesResponse = {
  results: MatchCompanyResult[]
  meta?: { llmSubBatches?: number; usage?: MatchCompaniesUsageTotals; model?: string }
}

export type MatchCompaniesHttpInfo = {
  batchIndex: number
  batchTotal: number
  itemCount: number
  serverLlmSubBatches?: number
  /** OpenAI model id for this HTTP response (if the server reported it). */
  modelThisRequest?: string
  /** Token usage for this HTTP response only (if the server reported it). */
  usageThisRequest?: MatchCompaniesUsageTotals
}

export async function postMatchCompanies(
  canonicalNames: string[],
  items: MatchCompanyItem[]
): Promise<MatchCompaniesResponse> {
  const res = await fetch(`${API_BASE}/api/match-companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ canonicalNames, items }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<MatchCompaniesResponse>
}

export type PostMatchCompaniesBatchedOptions = {
  /** Chunk size for this run (default {@link MATCH_API_BATCH_SIZE}). */
  clientBatchSize?: number
  /** Fires immediately before each POST. */
  onHttpRequestStart?: (info: Omit<MatchCompaniesHttpInfo, 'serverLlmSubBatches'>) => void
  /** Fires after each POST returns successfully. */
  onHttpRequestComplete?: (info: MatchCompaniesHttpInfo) => void
  /** Fires after each HTTP chunk completes (`completed` 1..`total`). */
  onBatchProgress?: (completed: number, total: number) => void
}

export type PostMatchCompaniesBatchedResult = {
  results: MatchCompanyResult[]
  /** Sum of `meta.usage` across all HTTP responses; null if nothing was reported. */
  usageTotals: MatchCompaniesUsageTotals | null
  /** Last non-empty `meta.model` seen across HTTP responses; null if never sent. */
  matcherModel: string | null
}

function addUsage(
  agg: MatchCompaniesUsageTotals,
  u: MatchCompaniesUsageTotals | undefined
): boolean {
  if (!u) return false
  agg.promptTokens += u.promptTokens ?? 0
  agg.completionTokens += u.completionTokens ?? 0
  agg.totalTokens += u.totalTokens ?? 0
  return true
}

/** Split items into batches; run sequentially to avoid huge payloads. */
export async function postMatchCompaniesBatched(
  canonicalNames: string[],
  items: MatchCompanyItem[],
  options?: PostMatchCompaniesBatchedOptions
): Promise<PostMatchCompaniesBatchedResult> {
  if (items.length === 0) return { results: [], usageTotals: null, matcherModel: null }
  const chunkSize = options?.clientBatchSize ?? MATCH_API_BATCH_SIZE
  const total = Math.ceil(items.length / chunkSize)
  const all: MatchCompanyResult[] = []
  const usageTotals: MatchCompaniesUsageTotals = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  let sawAnyUsage = false
  let matcherModel: string | null = null
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    const batchIndex = Math.floor(i / chunkSize) + 1
    options?.onHttpRequestStart?.({ batchIndex, batchTotal: total, itemCount: chunk.length })
    const { results, meta } = await postMatchCompanies(canonicalNames, chunk)
    all.push(...results)
    if (addUsage(usageTotals, meta?.usage)) sawAnyUsage = true
    const m = meta?.model?.trim()
    if (m) matcherModel = m
    options?.onHttpRequestComplete?.({
      batchIndex,
      batchTotal: total,
      itemCount: chunk.length,
      serverLlmSubBatches: meta?.llmSubBatches,
      modelThisRequest: m,
      usageThisRequest: meta?.usage,
    })
    const completed = batchIndex
    options?.onBatchProgress?.(completed, total)
  }
  return { results: all, usageTotals: sawAnyUsage ? usageTotals : null, matcherModel }
}
