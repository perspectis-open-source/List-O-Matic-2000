/**
 * @file matchCompanies.test.ts
 * @description postMatchCompaniesBatched progress callback and batching.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MATCH_API_BATCH_SIZE } from '../constants/companyMatch'
import { postMatchCompanies, postMatchCompaniesBatched } from './matchCompanies'

describe('postMatchCompaniesBatched', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('invokes onBatchProgress once per HTTP chunk in order', async () => {
    const n = MATCH_API_BATCH_SIZE + 10
    const items = Array.from({ length: n }, (_, i) => ({ raw: `r${i}`, topCandidates: [] as string[] }))
    const total = Math.ceil(n / MATCH_API_BATCH_SIZE)
    const progress: number[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          results: [],
          meta: {
            model: 'gpt-4o-mini',
            llmSubBatches: 1,
            usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
          },
          parentByCanon: { A: 'P1' },
          parentByRaw: {},
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    })
    await postMatchCompaniesBatched(['A'], items, {
      onBatchProgress: (completed, t) => {
        expect(t).toBe(total)
        progress.push(completed)
      },
    })
    expect(progress).toEqual(Array.from({ length: total }, (_, i) => i + 1))
  })

  it('returns empty array without calling fetch when items empty', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const out = await postMatchCompaniesBatched(['A'], [])
    expect(out).toEqual({
      results: [],
      usageTotals: null,
      matcherModel: null,
      parentByCanon: {},
      parentByRaw: {},
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('postMatchCompanies parses NDJSON stream and emits progress', async () => {
    const lines = [
      JSON.stringify({ type: 'progress', phase: 'step1', completed: 1, total: 2 }),
      JSON.stringify({
        type: 'complete',
        results: [{ raw: 'r0', match: null }],
        meta: {
          model: 'gpt-4o-mini',
          llmSubBatches: 3,
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        },
        parentByCanon: { Acme: 'Acme Parent' },
        parentByRaw: { r0: 'Raw Parent' },
      }),
    ]
    const enc = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(enc.encode(`${lines.join('\n')}\n`))
        controller.close()
      },
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
      })
    )
    const phases: string[] = []
    const out = await postMatchCompanies(['Acme'], [{ raw: 'r0', topCandidates: [] }], {
      onStreamProgress: (ev) => phases.push(ev.phase),
    })
    expect(phases).toEqual(['step1'])
    expect(out.results).toEqual([{ raw: 'r0', match: null }])
    expect(out.meta?.llmSubBatches).toBe(3)
    expect(out.parentByCanon).toEqual({ Acme: 'Acme Parent' })
    expect(out.parentByRaw).toEqual({ r0: 'Raw Parent' })
  })

  it('uses clientBatchSize and reports server llmSubBatches on complete', async () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ raw: `r${i}`, topCandidates: [] as string[] }))
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          results: [],
          meta: {
            model: 'gpt-4o-mini',
            llmSubBatches: 2,
            usage: { promptTokens: 100, completionTokens: 40, totalTokens: 140 },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    })
    const starts: number[] = []
    const completes: number[] = []
    const { usageTotals, matcherModel, parentByCanon, parentByRaw } = await postMatchCompaniesBatched(
      ['A'],
      items,
      {
        clientBatchSize: 10,
        onHttpRequestStart: ({ batchIndex }) => starts.push(batchIndex),
        onHttpRequestComplete: ({ serverLlmSubBatches, modelThisRequest }) => {
          completes.push(serverLlmSubBatches ?? 0)
          expect(modelThisRequest).toBe('gpt-4o-mini')
        },
      },
    )
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(starts).toEqual([1, 2, 3])
    expect(completes).toEqual([2, 2, 2])
    expect(usageTotals).toEqual({ promptTokens: 300, completionTokens: 120, totalTokens: 420 })
    expect(matcherModel).toBe('gpt-4o-mini')
    expect(parentByCanon).toEqual({})
    expect(parentByRaw).toEqual({})
  })

  it('runs up to concurrency parallel fetches, preserves result order, and completes onBatchProgress', async () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ raw: `r${i}`, topCandidates: [] as string[] }))
    const total = Math.ceil(25 / 10)
    let call = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      const myCall = call++
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 15)))
      const start = myCall * 10
      const slice = items.slice(start, start + 10)
      return new Response(
        JSON.stringify({
          results: slice.map((it) => ({ raw: it.raw, match: null })),
          meta: { model: 'gpt-4o-mini', llmSubBatches: 1, usage: { promptTokens: 1, completionTokens: 0, totalTokens: 1 } },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    })
    const progress: number[] = []
    const out = await postMatchCompaniesBatched(['A'], items, {
      clientBatchSize: 10,
      concurrency: 5,
      onBatchProgress: (c, t) => {
        expect(t).toBe(total)
        progress.push(c)
      },
    })
    expect(globalThis.fetch).toHaveBeenCalledTimes(3)
    expect(progress.length).toBe(3)
    expect([...progress].sort((a, b) => a - b)).toEqual([1, 2, 3])
    expect(out.results.map((r) => r.raw)).toEqual(items.map((it) => it.raw))
  })

  it('merges parentByCanon and parentByRaw across HTTP chunks', async () => {
    let call = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      call += 1
      if (call === 1) {
        return new Response(
          JSON.stringify({
            results: [{ raw: 'r0', match: 'A' }],
            meta: { model: 'gpt-4o-mini', llmSubBatches: 1 },
            parentByCanon: { A: 'ParentA' },
            parentByRaw: { r0: 'R0' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(
        JSON.stringify({
          results: [{ raw: 'r1', match: null }],
          meta: { model: 'gpt-4o-mini', llmSubBatches: 1 },
          parentByCanon: { A: 'ParentA', B: 'ParentB' },
          parentByRaw: { r1: 'R1' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    })
    const items = [
      { raw: 'r0', topCandidates: [] as string[] },
      { raw: 'r1', topCandidates: [] as string[] },
    ]
    const out = await postMatchCompaniesBatched(['A', 'B'], items, { clientBatchSize: 1 })
    expect(out.parentByCanon).toEqual({ A: 'ParentA', B: 'ParentB' })
    expect(out.parentByRaw).toEqual({ r0: 'R0', r1: 'R1' })
    expect(out.results).toEqual([
      { raw: 'r0', match: 'A' },
      { raw: 'r1', match: null },
    ])
  })
})
