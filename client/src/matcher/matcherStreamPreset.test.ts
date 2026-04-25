import { describe, expect, it } from 'vitest'
import { applyMatcherStreamProgress, logMatcherLlmCallProgress } from './matcherStreamPreset'
import type { MatcherLlmProgress, MatcherServerStreamProgress } from './matcherStreamTypes'

describe('applyMatcherStreamProgress', () => {
  it('updates step1 slice', () => {
    const prev: MatcherLlmProgress | null = { completed: 0, total: 1, server: {} }
    const ev: MatcherServerStreamProgress = { phase: 'step1', completed: 2, total: 5, cached: false }
    const next = applyMatcherStreamProgress(prev, ev, 1)
    expect(next.server?.step1).toEqual({ completed: 2, total: 5, cached: false })
  })

  it('ignores llm_call for server slice merge', () => {
    const prev: MatcherLlmProgress = { completed: 0, total: 1, server: { step1: { completed: 1, total: 1 } } }
    const ev: MatcherServerStreamProgress = {
      phase: 'llm_call',
      stepName: 'x',
      durationMs: 10,
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    }
    const next = applyMatcherStreamProgress(prev, ev, 1)
    expect(next.completed).toBe(0)
    expect(next.server?.step1).toEqual({ completed: 1, total: 1 })
  })
})

describe('logMatcherLlmCallProgress', () => {
  it('pushes a line and optional correlationId', () => {
    const lines: { line: string; cid?: string }[] = []
    logMatcherLlmCallProgress((line, cid) => lines.push({ line, cid }), {
      phase: 'llm_call',
      stepName: 'matcher.test',
      durationMs: 500,
      model: 'gpt-4o-mini',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      correlationId: '25ae963a-732b-43a7-a85e-bda40b863b9b',
    })
    expect(lines).toHaveLength(1)
    expect(lines[0].line).toContain('matcher.test')
    expect(lines[0].cid).toBe('25ae963a-732b-43a7-a85e-bda40b863b9b')
  })
})
