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
  meta?: {
    llmSubBatches?: number
    usage?: MatchCompaniesUsageTotals
    model?: string
    /** True when results were served from a disk snapshot (no LLM calls). */
    fromSnapshot?: boolean
    /** Rows resolved from the on-disk list snapshot without LLM (partial runs include this). */
    snapshotCacheHits?: number
  }
}

/** One NDJSON `progress` line from POST /api/match-companies when `streamProgress: true`. */
export type MatcherServerStreamProgress = {
  type?: 'progress'
  phase: 'step1' | 'step2' | 'step3' | 'fallback'
  completed?: number
  total?: number
  cached?: boolean
  detail?: string
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

async function readMatchCompaniesNdjsonStream(
  res: Response,
  onStreamProgress: (ev: MatcherServerStreamProgress) => void
): Promise<MatchCompaniesResponse> {
  const reader = res.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }
  const decoder = new TextDecoder()
  let buffer = ''
  let complete: MatchCompaniesResponse | null = null
  const handleLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return
    const msg = JSON.parse(trimmed) as {
      type?: string
      phase?: MatcherServerStreamProgress['phase']
      completed?: number
      total?: number
      cached?: boolean
      detail?: string
      results?: MatchCompanyResult[]
      meta?: MatchCompaniesResponse['meta']
      error?: string
    }
    if (msg.type === 'progress' && msg.phase) {
      onStreamProgress({
        phase: msg.phase,
        completed: msg.completed,
        total: msg.total,
        cached: msg.cached,
        detail: msg.detail,
      })
    }
    if (msg.type === 'complete') {
      complete = { results: msg.results ?? [], meta: msg.meta }
    }
    if (msg.type === 'error') {
      throw new Error(msg.error?.trim() || 'Match request failed')
    }
  }
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    for (;;) {
      const nl = buffer.indexOf('\n')
      if (nl === -1) break
      const line = buffer.slice(0, nl)
      buffer = buffer.slice(nl + 1)
      handleLine(line)
    }
  }
  if (buffer.trim()) handleLine(buffer)
  if (!complete) {
    throw new Error('Incomplete match response stream')
  }
  return complete
}

export type PostMatchCompaniesOptions = {
  onStreamProgress?: (ev: MatcherServerStreamProgress) => void
}

export async function postMatchCompanies(
  canonicalNames: string[],
  items: MatchCompanyItem[],
  options?: PostMatchCompaniesOptions
): Promise<MatchCompaniesResponse> {
  const streamProgress = Boolean(options?.onStreamProgress)
  const res = await fetch(`${API_BASE}/api/match-companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      canonicalNames,
      items,
      ...(streamProgress ? { streamProgress: true } : {}),
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`)
  }
  const ct = res.headers.get('content-type') ?? ''
  if (streamProgress && ct.includes('application/x-ndjson')) {
    return readMatchCompaniesNdjsonStream(res, options.onStreamProgress!)
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
  /** NDJSON progress events for the server three-step pipeline (one HTTP request may emit many). */
  onServerStreamProgress?: (ev: MatcherServerStreamProgress) => void
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
    const { results, meta } = await postMatchCompanies(
      canonicalNames,
      chunk,
      options?.onServerStreamProgress ? { onStreamProgress: options.onServerStreamProgress } : undefined
    )
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
    options?.onBatchProgress?.(batchIndex, total)
  }
  return { results: all, usageTotals: sawAnyUsage ? usageTotals : null, matcherModel }
}
