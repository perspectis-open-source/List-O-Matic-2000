/**
 * Marketing Demo API: POST /api/chat
 *
 * Logic:
 * 1. Take the input company name (from the user's selection).
 * 2. Search for all variants of that name: send the full list of unique company names
 *    from the contact file to the LLM; the LLM returns which of those names are
 *    variants of the input company (official name, subsidiaries, misspellings, typos).
 * 3. Return that list of variants. The frontend uses it to find all contact records
 *    where Company is in the variant list (no PII is sent to the server).
 *
 * Request: { messages, uniqueCompanyNames }. Response: { matchingCompanyNames, explanation? }.
 * See PLAN.md for full spec.
 */
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import OpenAI from 'openai'

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
  if (!text) {
    console.warn('[askLLM] Empty LLM response')
    return { matchingCompanyNames: [], parentCompany: null, explanation: '', reasoningSteps: [] }
  }
  const parsed = parseLLMJson(text)
  if (!parsed || typeof parsed !== 'object') {
    console.warn('[askLLM] Failed to parse LLM JSON')
    return { matchingCompanyNames: [], parentCompany: null, explanation: '', reasoningSteps: [] }
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

  while (iterations < MAX_AGENT_ITERATIONS) {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools: [SEARCH_WEB_TOOL],
      max_tokens: 4000,
    })
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
  }
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
    const nameSet = new Set(uniqueCompanyNames)
    const nameList = [...nameSet]
    const lowerToCanonical = new Map()
    for (const n of nameList) {
      const t = String(n).trim()
      if (t) lowerToCanonical.set(t.toLowerCase(), t)
    }
    const allMatches = []
    let explanation = ''
    let reasoningSteps = []
    let parentCompany = null

    const batches = batched(uniqueCompanyNames, BATCH_SIZE)
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const result =
        i === 0
          ? await runAgentLoop(openai, batch, inputCompanyQuery, refinementContext)
          : await askLLM(openai, batch, inputCompanyQuery, refinementContext)
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
