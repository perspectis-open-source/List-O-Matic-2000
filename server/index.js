/**
 * @file index.js
 * @description Marketing Demo API: POST /api/chat (Normalizer), POST /api/match-companies (Matcher LLM assist); no contact PII.
 *
 * Logic:
 * 1. Take the input company name (from the user's selection).
 * 2. Search for all variants of that name: send the full list of unique company names
 *    from the contact file to the LLM; the LLM returns which of those names are
 *    variants of the input company (official name, subsidiaries, misspellings, typos).
 * 3. Return that list of variants. The frontend uses it to find all contact records
 *    where Company is in the variant list (no PII is sent to the server).
 *
 * Contact Company Matcher (/api/match-companies): batched three-step pipeline — (1) infer parent per
 * canonical list row (cached by list fingerprint), (2) infer parent per contact raw, (3) deterministic
 * match on aligned parents; optional LLM fallback for rows with no parent match. Normalizer still uses
 * gatherMatchesForCompanyQuery (agent + list batches).
 *
 * Request: { messages, uniqueCompanyNames }. Response: { matchingCompanyNames, explanation? }.
 * See PLAN.md for full spec.
 */
import 'dotenv/config'
import crypto from 'node:crypto'
import express from 'express'
import cors from 'cors'
import OpenAI from 'openai'
import { crmRouter } from './crmConnector.js'

const app = express()
const PORT = process.env.PORT ?? 3001
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

app.use(cors({ origin: CORS_ORIGIN }))
// Match-companies sends ~500 contact + 500 CRM names; allow large JSON bodies (default is 100kb)
app.use(express.json({ limit: 2 * 1024 * 1024 }))

// AI Search: unique company names sent to LLM in batches. Revisit if list or token limits grow.
const BATCH_SIZE = 400
const MAX_AGENT_ITERATIONS = 3

const MOCK_SEARCH_GENERIC =
  'When building matchingCompanyNames, include every list entry that is the parent, a known subsidiary, or a known product/consumer brand of the parent (including names that are the brand plus LLC, Inc, or Co). Use the input company name and the provided list to identify which names refer to that company. Include product brands—e.g. for a parent like Procter & Gamble, include list entries such as Tide LLC or Pampers Inc if they appear in the list. Return only names that appear in the list.'

function mockSearchWeb(query, scopeCompany = null) {
  let q = (query || '').trim().slice(0, 200)
  if (scopeCompany && scopeCompany.trim()) {
    const scope = String(scopeCompany).trim()
    if (!q.toLowerCase().includes(scope.toLowerCase())) {
      q = `${scope} ${q}`
    }
  }
  return `Search results for "${q}": ${MOCK_SEARCH_GENERIC}`
}

const SEARCH_WEB_TOOL = {
  type: 'function',
  function: {
    name: 'search_web',
    description: 'Search for subsidiaries, brands, or related companies for a given company name. Use this to find which names in the list might belong to the same parent company.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Search query, e.g. "[company name] subsidiaries and brands"' } },
      required: ['query'],
    },
  },
}

const MAX_MESSAGES = 10
const MAX_MESSAGE_LENGTH = 2000

function validateBody(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid body' }
  const { messages, uniqueCompanyNames, previousMatchingNames, originalCompany } = body
  if (!Array.isArray(messages)) return { ok: false, error: 'messages must be an array' }
  if (messages.length > MAX_MESSAGES) return { ok: false, error: `Too many messages (max ${MAX_MESSAGES})` }
  for (const m of messages) {
    if (m?.content && String(m.content).length > MAX_MESSAGE_LENGTH) {
      return { ok: false, error: `Message exceeds ${MAX_MESSAGE_LENGTH} characters` }
    }
  }
  if (!Array.isArray(uniqueCompanyNames)) return { ok: false, error: 'uniqueCompanyNames must be an array' }
  const lastUser = [...messages].reverse().find((m) => m?.role === 'user')
  if (!lastUser?.content?.trim()) return { ok: false, error: 'No user message' }
  const names = uniqueCompanyNames.filter((n) => typeof n === 'string' && n.trim() !== '')
  const nameSet = new Set(names)
  let prevMatches = []
  if (previousMatchingNames != null && Array.isArray(previousMatchingNames)) {
    prevMatches = previousMatchingNames.filter((n) => typeof n === 'string' && nameSet.has(String(n).trim()))
  }
  const isRefinement = prevMatches.length > 0 || messages.length > 1
  const origCompany = originalCompany != null && String(originalCompany).trim() !== '' ? String(originalCompany).trim() : null
  return {
    ok: true,
    messages,
    uniqueCompanyNames: names,
    lastUserContent: lastUser.content.trim(),
    previousMatchingNames: prevMatches,
    isRefinement,
    originalCompany: isRefinement ? origCompany : null,
  }
}

function batched(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Run async fn over items with at most `limit` calls in flight (order of results matches `items`).
 * @param {(completed: number, total: number) => void} [onEachDone] Fires after each item completes (completed is 1..n).
 */
async function parallelMapLimit(items, limit, fn, onEachDone) {
  const n = items.length
  if (n === 0) return []
  const results = new Array(n)
  let next = 0
  let finished = 0
  const workers = Math.max(1, Math.min(limit, n))
  async function worker() {
    while (true) {
      const i = next++
      if (i >= n) break
      results[i] = await fn(items[i], i)
      finished += 1
      onEachDone?.(finished, n)
    }
  }
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return results
}

// Legal suffixes (longer forms first so "Inc." is stripped before "Inc")
const LEGAL_SUFFIXES = ['Inc.', 'Inc', 'Corp.', 'Corp', 'Ltd.', 'Ltd', 'Co.', 'Co', 'LLC', 'Limited', 'Computer']
const LEGAL_SUFFIXES_LOWER = new Set(LEGAL_SUFFIXES.map((s) => s.toLowerCase()))

/** Strip trailing legal suffix to get core company name (e.g. "Apple Inc." -> "Apple"). */
function getCoreCompanyName(parentCompany) {
  if (!parentCompany || typeof parentCompany !== 'string') return ''
  let s = parentCompany.trim()
  for (const suffix of LEGAL_SUFFIXES) {
    const withSpace = ' ' + suffix
    if (s.endsWith(withSpace)) return s.slice(0, -withSpace.length).trim()
  }
  return s
}

/** Add any list entry that is core name or core + legal suffix (so LLM misses like "Apple Ltd" are always included). */
function addParentSuffixVariants(nameList, parentCompany, into) {
  const core = getCoreCompanyName(parentCompany)
  if (!core) return
  const coreLower = core.toLowerCase()
  for (const name of nameList) {
    const t = String(name).trim()
    if (!t) continue
    if (t === core || t.toLowerCase() === coreLower) {
      into.push(t)
      continue
    }
    if (!t.toLowerCase().startsWith(coreLower + ' ')) continue
    const after = t.slice(core.length).trim().toLowerCase()
    if (LEGAL_SUFFIXES_LOWER.has(after)) into.push(t)
  }
}

function parseLLMJson(text) {
  if (!text || typeof text !== 'string') return null
  let raw = text.trim()
  const codeBlock = raw.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/m)
  if (codeBlock) raw = codeBlock[1].trim()
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const SYSTEM_PROMPT_MATCH = `You match company names to a parent company. Follow these steps exactly.

Step 1 — Infer the real parent company: The app cleans import data by matching to parent company data. The list is imported data which needs to be matched to the parent company data; the user's input may be accurate data (the real company name) or inaccurate data (variant, misspelling, shorthand). From the user's input, identify the single real, official parent company and output it as "parentCompany"—the official legal entity name (exact name as registered or used in SEC/regulatory filings). This is the value the user will see as "the parent company"; it must always be the real, canonical name. Do not use a variant, informal name, or copy from the list. Example: wrong "P&G", "Proctor and Gamble", or any list entry; right "Procter & Gamble". Infer parentCompany from your knowledge of the real company; never copy from the list.

Step 2 — Subsidiaries and brands: From your knowledge, list the parent's known subsidiaries and product/consumer brands. Output this as "subsidiariesAndBrands": an array of strings (brand and subsidiary names). Use this only to decide which list entries to include; do not copy subsidiariesAndBrands into matchingCompanyNames.

Step 3 — Match from the list only: You are given a list of company names. Scan every line. You must do both of the following:

(3a) Parent variants: Add every list entry that is the parent in any form—bare name; parent + Inc, Inc., Corp, Ltd, Co, LLC, Limited, Computer; the parent's stock ticker or abbreviation; any misspelling. The same company often appears with different legal suffixes in different regions (e.g. Inc in one country, Ltd in another). You MUST include every list entry that is the core parent name plus any legal suffix (Inc, Inc., Corp, Ltd, Co, LLC, Limited, Computer)—treat them all as the same parent. For any parent "X", include every list entry that is "X", "X Inc.", "X Ltd.", "X Corp.", "X LLC", "X Co.", etc., from the list. Before finishing, scan the list again: (i) any line that is the parent name (or core name) followed by a single legal-suffix word (Corp, Ltd, Inc, Co, LLC, Limited, Computer) must be in matchingCompanyNames; (ii) any line that is a clear misspelling or typo of the parent must be in matchingCompanyNames. Include "X Corp", "X Ltd", and obvious typos like "X Inc" spelled wrong.

(3b) Subsidiaries and brands: Add every list entry that is a subsidiary or operating entity of the parent, or a product/consumer brand of the parent (from inferredBrands or your knowledge). Include brand names with or without LLC, Inc, Co. Do not omit brands.

You must apply both (3a) and (3b). (3b) is required: do not omit subsidiaries or product/consumer brands that appear in the list. Copy each name character-for-character from the list; do not modify or rephrase. Be inclusive: when in doubt, include the name.

Output a JSON object with:
- "parentCompany": string — the real parent company you find from the user's input: the official legal entity name only. Must be real data (as registered or in filings), not bad data, variants, or list entries. Do not include any subsidiaries or product/consumer brands in this field or make anything up.
- "inferredBrands": array of strings — from your knowledge, the parent's known subsidiaries and product/consumer brands. Use only to decide which list entries to include; do not copy this array into matchingCompanyNames.
- "matchingCompanyNames": array of strings — each string must be an exact copy of one of the names from the provided list. No other names. Must satisfy both: (i) every parent variant (bare, Inc, Corp, Ltd, Co, LLC, ticker, misspelling); (ii) every subsidiary and every product/consumer brand (with or without LLC/Inc/Co). Do not skip Corp/Ltd variants or brands.
- "explanation": (optional) one short sentence.
- "reasoningSteps": array of objects with "title" and "detail". Every name in matchingCompanyNames must appear in exactly one "detail" (same exact string). The list is imported data (unknown data governance); the goal is to fix it by matching each entry to the real company (parentCompany). The canonical/official name is parentCompany—inferred in Step 1 from your knowledge, not from the list. Do NOT state that any list entry "is the official parent company name" or "is the canonical name" or "is found in the list as the official name." List entries are imported data. Use these categories:
  - **Matches inferred parent (exact):** Only when a list entry is character-for-character identical to parentCompany. In "detail", say only that this list entry matches the inferred canonical name (parentCompany); do not say the list entry "is" the official name.
  - **misspellings/variants:** List entries that are the company name with wrong suffix, shorthand, or typo. These are not real company names; they are bad data to be corrected to parentCompany.
  - **brand names:** Product brands as they appear in the list — not the company name.
  - **ubsidiaries:** Subsidiary/operating names.

In each "detail", state that the list entry is imported data being matched to the parent company (parentCompany). Never claim a list entry is the official or canonical company name.

Return ONLY valid JSON.`

async function askLLM(openai, batchNames, inputCompanyQuery, refinementContext = null) {
  console.log('[askLLM] openai:', typeof openai, 'batchNames:', batchNames?.length, 'items, sample:', batchNames?.slice(0, 5), 'inputCompanyQuery:', inputCompanyQuery, 'refinementContext:', refinementContext ? { originalCompany: refinementContext.originalCompany, previousMatchingCount: refinementContext.previousMatchingNames?.length, lastUserContent: refinementContext.lastUserContent?.slice(0, 80) } : null)
  let userPrompt = `User input (company name or query): ${inputCompanyQuery}\n\nList of company names below. You must do BOTH of the following:\n\n(1) Parent variants: Include every line that is the parent (bare, + Inc/Corp/Ltd/Co/LLC/Computer, ticker, or clear typo). Include the same company with any legal suffix—the parent name + Inc, Ltd, Corp, LLC, Co, etc. are all the same parent; scan for every parent+Corp, parent+Ltd, parent+Inc, etc., and typos.\n\n(2) Subsidiaries and brands: Include every line that is a subsidiary or a product/consumer brand of the parent. If the parent has product brands (e.g. beverage or consumer brands), include every list entry that matches those brands, with or without LLC/Inc/Co. Do not omit brands.\n\nReturn every matching line. Copy each name exactly as it appears.\n\nList:\n${batchNames.join('\n')}`
  if (refinementContext) {
    const scopeLine = refinementContext.originalCompany
      ? `\nCRITICAL: The user's original company filter is "${refinementContext.originalCompany}". Return ONLY names that refer to that company (or its subsidiaries/brands).\n`
      : ''
    userPrompt = `REFINEMENT.${scopeLine}\nPrevious matches: ${refinementContext.previousMatchingNames.slice(0, 50).join(', ')}${refinementContext.previousMatchingNames.length > 50 ? '...' : ''}\nUser instruction: ${refinementContext.lastUserContent}\n\nList (copy only from this list):\n${batchNames.join('\n')}`
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_MATCH },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 4000,
  })

  const text = completion.choices?.[0]?.message?.content?.trim()
  const emptyUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  if (!text) {
    console.warn('[askLLM] Empty LLM response')
    return { matchingCompanyNames: [], parentCompany: null, explanation: '', reasoningSteps: [], usage: emptyUsage }
  }
  const parsed = parseLLMJson(text)
  if (!parsed || typeof parsed !== 'object') {
    console.warn('[askLLM] Failed to parse LLM JSON')
    return { matchingCompanyNames: [], parentCompany: null, explanation: '', reasoningSteps: [], usage: emptyUsage }
  }
  const inferredBrands = Array.isArray(parsed.inferredBrands) ? parsed.inferredBrands : []
  if (inferredBrands.length === 0) {
    console.warn('[askLLM] inferredBrands missing or empty')
  }
  const steps = Array.isArray(parsed.reasoningSteps)
    ? parsed.reasoningSteps
        .filter((s) => s && typeof s.title === 'string')
        .slice(0, 20)
        .map((s) => ({
          title: String(s.title).slice(0, 200),
          detail: String(s.detail ?? '').slice(0, 500),
        }))
    : []
  const names = parsed.matchingCompanyNames ?? parsed.matching_names ?? []
  const parentCompany = typeof parsed.parentCompany === 'string' ? parsed.parentCompany.trim() : null
  const result = {
    matchingCompanyNames: Array.isArray(names) ? names : [],
    parentCompany,
    explanation: typeof parsed.explanation === 'string' ? parsed.explanation : '',
    reasoningSteps: steps,
    usage: completion.usage
      ? {
          prompt_tokens: completion.usage.prompt_tokens ?? 0,
          completion_tokens: completion.usage.completion_tokens ?? 0,
          total_tokens: completion.usage.total_tokens ?? 0,
        }
      : { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  }
  console.log('[askLLM] result:', { parentCompany: result.parentCompany, matchingCount: result.matchingCompanyNames.length, explanation: result.explanation?.slice(0, 80) })
  return result
}

const AGENT_SYSTEM_PROMPT = `${SYSTEM_PROMPT_MATCH}

You may call the search_web tool with a query like "[Parent company] subsidiaries and brands" to help list that parent's subsidiaries and brands before building matchingCompanyNames. When done, respond with the JSON object (parentCompany, matchingCompanyNames, explanation, reasoningSteps). Copy names only from the provided list.`

async function runAgentLoop(openai, batchNames, inputCompanyQuery, refinementContext = null) {
  console.log('[runAgentLoop] openai:', typeof openai, 'batchNames:', batchNames?.length, 'items, sample:', batchNames?.slice(0, 5), 'inputCompanyQuery:', inputCompanyQuery, 'refinementContext:', refinementContext ? { originalCompany: refinementContext.originalCompany, previousMatchingCount: refinementContext.previousMatchingNames?.length, lastUserContent: refinementContext.lastUserContent?.slice(0, 80) } : null)
  let userPrompt = `User input (company name or query): ${inputCompanyQuery}\n\nList of company names below. You must do BOTH of the following:\n\n(1) Parent variants: Include every line that is the parent (bare, + Inc/Corp/Ltd/Co/LLC/Computer, ticker, or clear typo). Include the same company with any legal suffix—the parent name + Inc, Ltd, Corp, LLC, Co, etc. are all the same parent; scan for every parent+Corp, parent+Ltd, parent+Inc, etc., and typos.\n\n(2) Subsidiaries and brands: Include every line that is a subsidiary or a product/consumer brand of the parent. If the parent has product brands (e.g. beverage or consumer brands), include every list entry that matches those brands, with or without LLC/Inc/Co. Do not omit brands.\n\nReturn every matching line. Copy each name exactly as it appears.\n\nList:\n${batchNames.join('\n')}`
  if (refinementContext) {
    const scopeLine = refinementContext.originalCompany
      ? `\nCRITICAL: Return ONLY names that refer to "${refinementContext.originalCompany}" (or its subsidiaries/brands).\n`
      : ''
    userPrompt = `REFINEMENT.${scopeLine}\nPrevious matches: ${refinementContext.previousMatchingNames.slice(0, 50).join(', ')}${refinementContext.previousMatchingNames.length > 50 ? '...' : ''}\nUser instruction: ${refinementContext.lastUserContent}\n\nList (copy only from this list):\n${batchNames.join('\n')}`
  }
  const messages = [
    { role: 'system', content: AGENT_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]
  let iterations = 0
  const usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

  while (iterations < MAX_AGENT_ITERATIONS) {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools: [SEARCH_WEB_TOOL],
      max_tokens: 4000,
    })
    const u = completion.usage
    if (u) {
      usage.prompt_tokens += u.prompt_tokens ?? 0
      usage.completion_tokens += u.completion_tokens ?? 0
      usage.total_tokens += u.total_tokens ?? 0
    }
    const msg = completion.choices?.[0]?.message
    if (!msg) break
    messages.push(msg)

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const tc of msg.tool_calls) {
        if (tc.function?.name === 'search_web') {
          let args = {}
          try {
            args = JSON.parse(tc.function.arguments || '{}')
          } catch {}
          let q = String(args.query || '').trim().slice(0, 200)
          const scopeCompany = refinementContext?.originalCompany || null
          if (scopeCompany && !q.toLowerCase().includes(scopeCompany.toLowerCase())) {
            q = `${scopeCompany} ${q}`.trim()
          }
          const result = mockSearchWeb(q, scopeCompany)
          console.log('[runAgentLoop] tool search_web query:', q)
          messages.push({ role: 'tool', tool_call_id: tc.id, content: result || 'No results.' })
        }
      }
      iterations++
      continue
    }

    const text = msg.content?.trim()
    if (text) {
      const parsed = parseLLMJson(text)
      if (parsed && typeof parsed === 'object') {
        const inferredBrands = Array.isArray(parsed.inferredBrands) ? parsed.inferredBrands : []
        if (inferredBrands.length === 0) {
          console.warn('[runAgentLoop] inferredBrands missing or empty')
        }
        const steps = Array.isArray(parsed.reasoningSteps)
          ? parsed.reasoningSteps
              .filter((s) => s && typeof s.title === 'string')
              .slice(0, 20)
              .map((s) => ({
                title: String(s.title).slice(0, 200),
                detail: String(s.detail ?? '').slice(0, 500),
              }))
          : []
        const names = parsed.matchingCompanyNames ?? parsed.matching_names ?? []
        const parentCompany = typeof parsed.parentCompany === 'string' ? parsed.parentCompany.trim() : null
        const result = {
          matchingCompanyNames: Array.isArray(names) ? names : [],
          parentCompany,
          explanation: typeof parsed.explanation === 'string' ? parsed.explanation : '',
          reasoningSteps: steps,
          usage,
        }
        console.log('[runAgentLoop] result:', { parentCompany: result.parentCompany, matchingCount: result.matchingCompanyNames.length })
        return result
      }
    }
    break
  }
  console.warn('[runAgentLoop] Agent did not return valid JSON or exceeded iterations')
  return {
    matchingCompanyNames: [],
    parentCompany: null,
    explanation: 'Agent did not complete in time.',
    reasoningSteps: [],
    usage,
  }
}

/**
 * Same multi-batch + agent flow as Contact Company Normalizer: scan nameList for every line that
 * belongs to the entity implied by inputCompanyQuery (parent, brands, subsidiaries, typos).
 */
async function gatherMatchesForCompanyQuery(openai, rawNameList, inputCompanyQuery, refinementContext = null) {
  const nameList = [...new Set(rawNameList.map((n) => String(n).trim()).filter(Boolean))]
  const nameSet = new Set(nameList)
  const lowerToCanonical = new Map()
  for (const n of nameList) {
    const t = String(n).trim()
    if (t) lowerToCanonical.set(t.toLowerCase(), t)
  }
  const batches = batched(nameList, BATCH_SIZE)
  const allMatches = []
  let explanation = ''
  let reasoningSteps = []
  let parentCompany = null
  const usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  let llmCallCount = 0

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    const result =
      i === 0
        ? await runAgentLoop(openai, batch, inputCompanyQuery, refinementContext)
        : await askLLM(openai, batch, inputCompanyQuery, refinementContext)
    llmCallCount++
    if (result.usage) {
      usage.prompt_tokens += result.usage.prompt_tokens ?? 0
      usage.completion_tokens += result.usage.completion_tokens ?? 0
      usage.total_tokens += result.usage.total_tokens ?? 0
    }
    const matching = Array.isArray(result.matchingCompanyNames) ? result.matchingCompanyNames : []
    for (const name of matching) {
      const s = String(name).trim()
      if (!s) continue
      if (nameSet.has(s)) {
        allMatches.push(s)
      } else {
        const canonical = lowerToCanonical.get(s.toLowerCase())
        if (canonical) allMatches.push(canonical)
      }
    }
    if (result.explanation) explanation = result.explanation
    if (result.parentCompany && typeof result.parentCompany === 'string') parentCompany = result.parentCompany.trim()
    if (Array.isArray(result.reasoningSteps) && result.reasoningSteps.length > 0 && reasoningSteps.length === 0) {
      reasoningSteps = result.reasoningSteps
    }
  }
  if (parentCompany) addParentSuffixVariants(nameList, parentCompany, allMatches)
  const matchingCompanyNames = [...new Set(allMatches)]
  return { matchingCompanyNames, parentCompany, explanation, reasoningSteps, llmCallCount, usage }
}

app.post('/api/chat', async (req, res, next) => {
  try {
    const validated = validateBody(req.body)
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error })
    }

    const { uniqueCompanyNames, lastUserContent, previousMatchingNames, isRefinement, originalCompany } = validated
    console.log('[POST /api/chat] request:', { uniqueCompanyNamesCount: uniqueCompanyNames?.length, lastUserContent: lastUserContent?.slice(0, 100), isRefinement, originalCompany: originalCompany ?? null })
    const refinementContext = isRefinement && previousMatchingNames.length > 0
      ? { previousMatchingNames, lastUserContent, originalCompany }
      : null
    const inputCompanyQuery = (isRefinement && originalCompany) ? originalCompany : lastUserContent

    if (!OPENAI_API_KEY) {
      return res.status(503).json({ error: 'LLM not configured (OPENAI_API_KEY missing)' })
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY })
    const {
      matchingCompanyNames,
      parentCompany,
      explanation,
      reasoningSteps,
    } = await gatherMatchesForCompanyQuery(openai, uniqueCompanyNames, inputCompanyQuery, refinementContext)
    const payload = { matchingCompanyNames, explanation: explanation || undefined }
    if (parentCompany) payload.parentCompany = parentCompany
    if (reasoningSteps.length > 0) payload.reasoningSteps = reasoningSteps
    console.log('[POST /api/chat] response:', { parentCompany: payload.parentCompany, matchingCount: matchingCompanyNames.length })
    return res.status(200).json(payload)
  } catch (err) {
    if (err.status === 429) return res.status(429).json({ error: 'Rate limit exceeded' })
    if (err.code === 'ETIMEDOUT') return res.status(504).json({ error: 'Request timeout' })
    if (err.message?.includes('rate')) return res.status(429).json({ error: 'Rate limit exceeded' })
    console.error('[POST /api/chat]', err.message || err)
    next(err)
  }
})

const MATCH_MAX_CANONICAL = 2500
const MATCH_MAX_ITEMS_PER_REQUEST = 200
/** Max import strings per single matcher LLM call (balance cost vs. payload size). */
const MATCH_LLM_BATCH = 50
/**
 * Max concurrent OpenAI completions for matcher sub-batches (step 1 / 2 / fallback).
 * Override with env MATCH_LLM_CONCURRENCY (1–12). Higher = faster cold start, more rate-limit risk.
 */
const MATCH_LLM_CONCURRENCY = Math.min(
  12,
  Math.max(1, Number.parseInt(process.env.MATCH_LLM_CONCURRENCY ?? '', 10) || 5),
)
/** Chat model for /api/match-companies (client uses this for cost estimates). */
const MATCH_COMPANIES_MODEL = 'gpt-4o-mini'

/** LRU cache: fingerprint of canonical list → Map(canonical Name → inferred parent string). */
const PARENT_BY_CANON_CACHE_MAX = 16
const parentByCanonCache = new Map()

function canonicalNamesFingerprint(canonicalNames) {
  const sorted = [...canonicalNames].sort((a, b) => a.localeCompare(b))
  return crypto.createHash('sha256').update(sorted.join('\0'), 'utf8').digest('hex')
}

function parentCacheGet(fingerprint) {
  const row = parentByCanonCache.get(fingerprint)
  if (!row) return null
  parentByCanonCache.delete(fingerprint)
  parentByCanonCache.set(fingerprint, row)
  return row
}

function parentCacheSet(fingerprint, parentByCanon) {
  if (parentByCanonCache.has(fingerprint)) parentByCanonCache.delete(fingerprint)
  else if (parentByCanonCache.size >= PARENT_BY_CANON_CACHE_MAX) {
    const oldest = parentByCanonCache.keys().next().value
    parentByCanonCache.delete(oldest)
  }
  parentByCanonCache.set(fingerprint, parentByCanon)
}

function accumulateMatcherUsage(totals, u) {
  if (!u) return
  totals.promptTokens += u.prompt_tokens ?? 0
  totals.completionTokens += u.completion_tokens ?? 0
  totals.totalTokens += u.total_tokens ?? 0
}

function mergeMatcherUsageTotals(into, from) {
  into.promptTokens += from.promptTokens
  into.completionTokens += from.completionTokens
  into.totalTokens += from.totalTokens
}

function normalizeParentLabel(s) {
  if (!s || typeof s !== 'string') return ''
  return s.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Loose alignment so LLM paraphrases of the same parent still match. */
function parentLabelsAlign(listParent, contactParent) {
  const a = normalizeParentLabel(listParent)
  const b = normalizeParentLabel(contactParent)
  if (!a || !b) return false
  if (a === b) return true
  const tokenize = (x) =>
    [...new Set(x.split(/[^a-z0-9]+/).filter((t) => t.length > 0))].sort().join(' ')
  if (tokenize(a) === tokenize(b)) return true
  if (a.length >= 6 && b.length >= 6 && (a.includes(b) || b.includes(a))) return true
  return false
}

function pickMatchFromParentMaps(raw, contactParent, parentByCanon, canonicalNames, canonSet) {
  const cp = typeof contactParent === 'string' ? contactParent.trim() : ''
  if (!cp) return { raw, match: null, alternates: [] }
  const candidates = []
  for (const name of canonicalNames) {
    if (!canonSet.has(name)) continue
    const lp = parentByCanon.get(name) ?? ''
    if (!parentLabelsAlign(lp, cp)) continue
    candidates.push(name)
  }
  if (candidates.length === 0) return { raw, match: null, alternates: [] }
  candidates.sort((a, b) => a.length - b.length || a.localeCompare(b))
  const match = candidates[0]
  const alternates = [...new Set(candidates.slice(1, 11))]
  return { raw, match, alternates }
}

/** Shared by step 1 (canonical list) and step 2 (contact raws) so parentCompany strings align in step 3. */
const MATCHER_LLM_PARENT_COMPANY_RULES = `Rules for every "parentCompany" value (identical meaning in all tasks):
- Output exactly one ultimate parent or top holding company—the entity at the top of the ownership chain—not a subsidiary, division, regional operating company, or consumer/product brand when a single clearer ultimate parent is well known.
- Use the full legal / filing-style name as used in SEC or equivalent regulatory filings when you know it (include standard corporate suffixes like Inc., Ltd., PLC when that is the filing name). Never use stock tickers or trading symbols.
- Do not use a division, segment, or brand name as parentCompany when that unit rolls up to a well-known ultimate parent (example: for names or imports referring to AWS or Amazon Web Services, parentCompany must be the ultimate Amazon parent legal name such as Amazon.com, Inc.—not "AWS", not "Amazon Web Services" alone).
- For the same ultimate parent, use one consistent filing-style phrasing across every entry in this response (do not mix a division name on one row and the holding company on another).`

const MATCHER_LLM_SYSTEM_PARENT =
  'You infer ultimate parent companies for downstream string matching. Every parentCompany must follow the user message rules exactly (one full legal ultimate parent, no tickers, no division-only labels when a filing-style parent is known). Return only valid JSON matching the user schema.'

async function inferParentsForCanonicalListBatch(openai, namesBatch) {
  const set = new Set(namesBatch)
  const listStr = namesBatch.join('\n')
  const userPrompt = `Each line below is one exact company name from the user's companies file (closed list). For each line, infer the single real ultimate parent company—the major operating or holding company that owns or controls that entity (use well-known corporate structures; consumer brands often roll up to the major beverage/CPG conglomerate when that is the real parent).

${MATCHER_LLM_PARENT_COMPANY_RULES}

Output JSON: { "entries": [ { "name": "<exact line from input>", "parentCompany": "<inferred parent>" } ] }
Include one entry per input line. "name" must copy the input line exactly.

Names (one per line):
${listStr}`

  const completion = await openai.chat.completions.create({
    model: MATCH_COMPANIES_MODEL,
    messages: [
      {
        role: 'system',
        content: MATCHER_LLM_SYSTEM_PARENT,
      },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 4000,
  })

  const text = completion.choices?.[0]?.message?.content?.trim()
  const parsed = parseLLMJson(text)
  const arr = parsed?.entries
  const parentByCanon = new Map()
  for (const n of namesBatch) parentByCanon.set(n, '')
  if (Array.isArray(arr)) {
    for (const e of arr) {
      const name = typeof e.name === 'string' ? e.name.trim() : ''
      const parentCompany = typeof e.parentCompany === 'string' ? e.parentCompany.trim() : ''
      if (name && set.has(name)) parentByCanon.set(name, parentCompany)
    }
  }
  const u = completion.usage
  const usage = u
    ? {
        prompt_tokens: u.prompt_tokens ?? 0,
        completion_tokens: u.completion_tokens ?? 0,
        total_tokens: u.total_tokens ?? 0,
      }
    : null
  return { parentByCanon, usage }
}

async function inferParentsForContactRawsBatch(openai, itemsBatch) {
  const rawSet = new Set(itemsBatch.map((it) => it.raw))
  const itemsDesc = itemsBatch
    .map((it) => JSON.stringify({ raw: it.raw, topCandidates: it.topCandidates }))
    .join('\n')
  const userPrompt = `Each line is a JSON object with "raw" (contact import string) and optional "topCandidates" hints. For each object, infer the single real ultimate parent company for that entity (major operating/holding company). Import strings may be noisy shorthand (e.g. acronyms, misspellings, or division names like "AWS"); still resolve to the same filing-style ultimate parent you would use for the official list names in the other batch.

${MATCHER_LLM_PARENT_COMPANY_RULES}

Output JSON: { "entries": [ { "raw": "<exact raw from input>", "parentCompany": "<inferred parent>" } ] }
Every input object must appear exactly once; "raw" must match exactly.

Items:
${itemsDesc}`

  const completion = await openai.chat.completions.create({
    model: MATCH_COMPANIES_MODEL,
    messages: [
      {
        role: 'system',
        content: MATCHER_LLM_SYSTEM_PARENT,
      },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 4000,
  })

  const text = completion.choices?.[0]?.message?.content?.trim()
  const parsed = parseLLMJson(text)
  const arr = parsed?.entries
  const parentByRaw = new Map()
  for (const it of itemsBatch) parentByRaw.set(it.raw, '')
  if (Array.isArray(arr)) {
    for (const e of arr) {
      const raw = typeof e.raw === 'string' ? e.raw.trim() : ''
      const parentCompany = typeof e.parentCompany === 'string' ? e.parentCompany.trim() : ''
      if (raw && rawSet.has(raw)) parentByRaw.set(raw, parentCompany)
    }
  }
  const u = completion.usage
  const usage = u
    ? {
        prompt_tokens: u.prompt_tokens ?? 0,
        completion_tokens: u.completion_tokens ?? 0,
        total_tokens: u.total_tokens ?? 0,
      }
    : null
  return { parentByRaw, usage }
}

/**
 * Step 1 (cached) + step 2 + deterministic step 3; LLM fallback batches for unmatched raws.
 * @param {(ev: { type: 'progress', phase: string, completed?: number, total?: number, cached?: boolean, detail?: string }) => void} [progressSink] NDJSON progress lines for the client.
 */
async function runThreeStepMatchCompanies(openai, canonicalNames, items, canonSet, lowerToCanon, progressSink) {
  const usageTotals = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  let llmSubBatches = 0

  const fp = canonicalNamesFingerprint(canonicalNames)
  let parentByCanon = parentCacheGet(fp)

  function emitProgress(ev) {
    progressSink?.({ type: 'progress', ...ev })
  }

  async function runStep1Batches() {
    const local = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    let batches = 0
    const map = new Map()
    const chunks = batched(canonicalNames, MATCH_LLM_BATCH)
    const totalChunks = chunks.length
    if (totalChunks === 0) return { map, local, batches }
    emitProgress({ phase: 'step1', completed: 0, total: totalChunks, cached: false })
    const parts = await parallelMapLimit(
      chunks,
      MATCH_LLM_CONCURRENCY,
      (batch) => inferParentsForCanonicalListBatch(openai, batch),
      (done, tot) => {
        emitProgress({ phase: 'step1', completed: done, total: tot, cached: false })
      },
    )
    for (const { parentByCanon: chunk, usage } of parts) {
      accumulateMatcherUsage(local, usage)
      batches += 1
      for (const [k, v] of chunk) map.set(k, v)
    }
    return { map, local, batches }
  }

  async function runStep2Batches() {
    const local = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    let batches = 0
    const map = new Map()
    const chunks = batched(items, MATCH_LLM_BATCH)
    const totalChunks = chunks.length
    if (totalChunks === 0) return { map, local, batches }
    emitProgress({ phase: 'step2', completed: 0, total: totalChunks })
    const parts = await parallelMapLimit(
      chunks,
      MATCH_LLM_CONCURRENCY,
      (batch) => inferParentsForContactRawsBatch(openai, batch),
      (done, tot) => {
        emitProgress({ phase: 'step2', completed: done, total: tot })
      },
    )
    for (const { parentByRaw: chunk, usage } of parts) {
      accumulateMatcherUsage(local, usage)
      batches += 1
      for (const [k, v] of chunk) map.set(k, v)
    }
    return { map, local, batches }
  }

  let parentByRaw
  if (parentByCanon) {
    emitProgress({ phase: 'step1', completed: 1, total: 1, cached: true })
    const s2 = await runStep2Batches()
    parentByRaw = s2.map
    mergeMatcherUsageTotals(usageTotals, s2.local)
    llmSubBatches += s2.batches
  } else {
    const [s1, s2] = await Promise.all([runStep1Batches(), runStep2Batches()])
    parentByCanon = s1.map
    parentByRaw = s2.map
    parentCacheSet(fp, parentByCanon)
    mergeMatcherUsageTotals(usageTotals, s1.local)
    mergeMatcherUsageTotals(usageTotals, s2.local)
    llmSubBatches += s1.batches + s2.batches
  }

  emitProgress({
    phase: 'step3',
    completed: 1,
    total: 1,
    detail: 'Matching on inferred parent labels (no model)',
  })

  const byRaw = new Map()
  for (const it of items) {
    const inferred = pickMatchFromParentMaps(
      it.raw,
      parentByRaw.get(it.raw) ?? '',
      parentByCanon,
      canonicalNames,
      canonSet,
    )
    byRaw.set(it.raw, inferred)
  }

  const needFallback = items.filter((it) => !byRaw.get(it.raw)?.match)
  const fallbackChunks = batched(needFallback, MATCH_LLM_BATCH).filter((b) => b.length > 0)
  if (fallbackChunks.length > 0) {
    emitProgress({ phase: 'fallback', completed: 0, total: fallbackChunks.length })
    const fbParts = await parallelMapLimit(
      fallbackChunks,
      MATCH_LLM_CONCURRENCY,
      (batch) => askMatchCompaniesLLM(openai, canonicalNames, batch, canonSet, lowerToCanon),
      (done, tot) => {
        emitProgress({ phase: 'fallback', completed: done, total: tot })
      },
    )
    for (const { results: part, usage } of fbParts) {
      accumulateMatcherUsage(usageTotals, usage)
      llmSubBatches += 1
      for (const r of part) byRaw.set(r.raw, r)
    }
  }

  const results = items.map((it) => byRaw.get(it.raw) ?? { raw: it.raw, match: null, alternates: [] })
  return { results, usageTotals, llmSubBatches }
}

function validateMatchCompaniesBody(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid body' }
  const { canonicalNames, items } = body
  if (!Array.isArray(canonicalNames)) return { ok: false, error: 'canonicalNames must be an array' }
  if (!Array.isArray(items)) return { ok: false, error: 'items must be an array' }
  const cn = canonicalNames
    .filter((n) => typeof n === 'string' && n.trim() !== '')
    .map((n) => n.trim())
  if (cn.length === 0) return { ok: false, error: 'canonicalNames must be non-empty' }
  if (cn.length > MATCH_MAX_CANONICAL) {
    return { ok: false, error: `Too many canonical names (max ${MATCH_MAX_CANONICAL})` }
  }
  const canonSet = new Set(cn)
  const lowerToCanon = new Map()
  for (const name of cn) lowerToCanon.set(name.toLowerCase(), name)

  const cleaned = []
  const seenRaw = new Set()
  for (const it of items) {
    if (!it || typeof it !== 'object') continue
    const raw = typeof it.raw === 'string' ? it.raw.trim() : ''
    if (!raw || seenRaw.has(raw)) continue
    seenRaw.add(raw)
    const topCandidates = Array.isArray(it.topCandidates)
      ? [...new Set(it.topCandidates.filter((x) => typeof x === 'string').map((x) => x.trim()).filter(Boolean))].slice(0, 12)
      : []
    cleaned.push({ raw, topCandidates })
    if (cleaned.length >= MATCH_MAX_ITEMS_PER_REQUEST) break
  }
  return { ok: true, canonicalNames: cn, canonSet, lowerToCanon, items: cleaned }
}

function sanitizeMatchResults(parsedResults, canonSet, lowerToCanon, items) {
  const byRaw = new Map()
  if (!Array.isArray(parsedResults)) {
    return items.map((it) => ({ raw: it.raw, match: null, alternates: [] }))
  }
  for (const r of parsedResults) {
    const raw = typeof r.raw === 'string' ? r.raw.trim() : ''
    if (!raw) continue
    let match = r.match != null && typeof r.match === 'string' ? r.match.trim() : null
    if (match === '') match = null
    if (match && !canonSet.has(match)) {
      const fix = lowerToCanon.get(match.toLowerCase())
      match = fix ?? null
    }
    if (match && !canonSet.has(match)) match = null
    let alternates = Array.isArray(r.alternates)
      ? r.alternates
          .filter((x) => typeof x === 'string' && canonSet.has(String(x).trim()))
          .map((x) => String(x).trim())
      : []
    alternates = [...new Set(alternates)].filter((a) => a !== match)
    byRaw.set(raw, { raw, match, alternates })
  }
  return items.map((it) => byRaw.get(it.raw) ?? { raw: it.raw, match: null, alternates: [] })
}

/**
 * One completion per batch: map many import raws → one list Name each (cheap).
 * Prompts borrow Normalizer-style intent (brands, typos, prefer parent row when in list) without
 * per-raw agent + list batching.
 */
async function askMatchCompaniesLLM(openai, canonicalNames, items, canonSet, lowerToCanon) {
  const listStr = canonicalNames.join('\n')
  const itemsDesc = items
    .map((it) => JSON.stringify({ raw: it.raw, topCandidates: it.topCandidates }))
    .join('\n')
  const userPrompt = `Canonical company names from the user's companies file (exact strings). Your "match" MUST be exactly one of these strings or null:\n${listStr}\n\nFor each item, pick the single best canonical row for the raw contact import string, or null if none fit. Use the same mental model as parent-company / brand matching: the import may be a misspelling, shorthand, or a product/consumer brand; infer the intended entity, then choose one list line.\n\nDisambiguation:\n- Product / consumer brands (e.g. beverages): if the list has both a brand-specific line and a clear parent or ultimate operating company line for that brand, prefer the parent as "match" when it is the better rollup. If only the brand line exists in the list, use that line.\n- Fix obvious typos before matching; "match" must be copied exactly from the list.\n- Optional "alternates": other plausible list lines (e.g. brand row when match is parent).\n\nIf topCandidates is non-empty you may use them as hints but may still choose another list name.\n\nItems (one JSON object per line):\n${itemsDesc}\n\nReturn JSON: { "results": [ { "raw": "<exact raw>", "match": "<exact canonical from list or null>", "alternates": [] } ] }\nEvery input raw must appear exactly once in results with the same "raw" string.`

  const completion = await openai.chat.completions.create({
    model: MATCH_COMPANIES_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You map noisy import strings to one companies-file Name per row (closed list). Infer brands, typos, and parents like the Normalizer would, but output only one "match" per item—exact list string or null. Prefer a parent/ultimate operating company list row over a brand-only row when both exist and parent is the better rollup. Return only valid JSON.',
      },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 4000,
  })

  const text = completion.choices?.[0]?.message?.content?.trim()
  const parsed = parseLLMJson(text)
  const arr = parsed?.results
  const results = sanitizeMatchResults(arr, canonSet, lowerToCanon, items)
  const u = completion.usage
  const usage = u
    ? {
        prompt_tokens: u.prompt_tokens ?? 0,
        completion_tokens: u.completion_tokens ?? 0,
        total_tokens: u.total_tokens ?? 0,
      }
    : null
  return { results, usage }
}

function matchCompaniesMeta(llmSubBatches, usageTotals) {
  return {
    model: MATCH_COMPANIES_MODEL,
    llmSubBatches,
    usage: usageTotals,
  }
}

app.post('/api/match-companies', async (req, res, next) => {
  const streamProgress = req.body && req.body.streamProgress === true
  try {
    const validated = validateMatchCompaniesBody(req.body)
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error })
    }
    const { canonicalNames, canonSet, lowerToCanon, items } = validated
    if (items.length === 0) {
      const emptyMeta = matchCompaniesMeta(0, { promptTokens: 0, completionTokens: 0, totalTokens: 0 })
      if (streamProgress) {
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache')
        res.write(`${JSON.stringify({ type: 'complete', results: [], meta: emptyMeta })}\n`)
        return res.end()
      }
      return res.status(200).json({
        results: [],
        meta: emptyMeta,
      })
    }

    if (!OPENAI_API_KEY) {
      return res.status(503).json({ error: 'LLM not configured (OPENAI_API_KEY missing)' })
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

    const run = async (progressSink) =>
      runThreeStepMatchCompanies(openai, canonicalNames, items, canonSet, lowerToCanon, progressSink)

    if (streamProgress) {
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('X-Accel-Buffering', 'no')
      try {
        const { results: allResults, usageTotals, llmSubBatches } = await run((ev) => {
          res.write(`${JSON.stringify(ev)}\n`)
        })
        console.log('[POST /api/match-companies]', {
          items: items.length,
          llmSubBatches,
          tokens: usageTotals.totalTokens,
          stream: true,
        })
        res.write(
          `${JSON.stringify({
            type: 'complete',
            results: allResults,
            meta: matchCompaniesMeta(llmSubBatches, usageTotals),
          })}\n`,
        )
        return res.end()
      } catch (err) {
        const code = err.status === 429 || err.message?.includes('rate') ? 429 : err.code === 'ETIMEDOUT' ? 504 : 500
        const msg =
          code === 429
            ? 'Rate limit exceeded'
            : code === 504
              ? 'Request timeout'
              : (err.message && String(err.message).trim()) || 'Internal server error'
        res.write(`${JSON.stringify({ type: 'error', error: msg, status: code })}\n`)
        return res.end()
      }
    }

    const { results: allResults, usageTotals, llmSubBatches } = await run(undefined)
    console.log('[POST /api/match-companies]', {
      items: items.length,
      llmSubBatches,
      tokens: usageTotals.totalTokens,
    })
    return res.status(200).json({
      results: allResults,
      meta: matchCompaniesMeta(llmSubBatches, usageTotals),
    })
  } catch (err) {
    if (err.status === 429) return res.status(429).json({ error: 'Rate limit exceeded' })
    if (err.code === 'ETIMEDOUT') return res.status(504).json({ error: 'Request timeout' })
    if (err.message?.includes('rate')) return res.status(429).json({ error: 'Rate limit exceeded' })
    console.error('[POST /api/match-companies]', err.message || err)
    next(err)
  }
})

app.use(crmRouter)

// Catch any unhandled errors (e.g. PayloadTooLargeError from body-parser, OpenAI SDK)
app.use((err, _req, res, _next) => {
  console.error('[server error]', err)
  if (err?.type === 'entity.too.large' || err?.status === 413) {
    return res.status(413).json({ error: 'Request body too large. Try fewer companies or contact names.' })
  }
  const msg = err?.message ?? err?.error ?? (typeof err === 'string' ? err : null)
  res.status(500).json({ error: (msg && String(msg).trim()) || 'Internal server error' })
})

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
