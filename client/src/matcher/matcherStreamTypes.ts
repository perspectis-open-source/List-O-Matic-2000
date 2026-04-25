import type { Dispatch, SetStateAction } from 'react'

/** Cumulative token counts from the OpenAI Chat Completions API. */
export type MatchCompaniesUsageTotals = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/** One NDJSON `progress` line from POST /api/match-companies when `streamProgress: true`. */
export type MatcherServerStreamProgress = {
  type?: 'progress'
  phase: 'step1' | 'step2' | 'step3' | 'fallback' | 'llm_call'
  completed?: number
  total?: number
  cached?: boolean
  detail?: string
  /** Present when `phase === 'llm_call'` (one OpenAI completion). */
  stepName?: string
  model?: string
  /** Wall-clock ms for that completion (server-measured). */
  durationMs?: number
  usage?: MatchCompaniesUsageTotals
  callOrdinal?: number
  /** ALS correlation for this HTTP request (server `llm_call` lines). */
  correlationId?: string
}

export type MatcherPhaseSlice = { completed: number; total: number; cached?: boolean }

/** HTTP batch progress plus optional server-side pipeline slices (one HTTP request). */
export type MatcherLlmProgress = {
  completed: number
  total: number
  server?: {
    step1?: MatcherPhaseSlice
    step2?: MatcherPhaseSlice
    step3?: { done: boolean; detail?: string }
    fallback?: MatcherPhaseSlice
  }
}

/** One row in the matcher activity UI; `correlationId` enables evidence expand when present. */
export type MatcherActivityLogEntry = {
  line: string
  correlationId?: string
}

export type MatcherActivityLogSetter = Dispatch<SetStateAction<MatcherActivityLogEntry[]>>
