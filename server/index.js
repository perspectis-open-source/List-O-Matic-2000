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
app.use(express.json())

const BATCH_SIZE = 400

function validateBody(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid body' }
  const { messages, uniqueCompanyNames } = body
  if (!Array.isArray(messages)) return { ok: false, error: 'messages must be an array' }
  if (!Array.isArray(uniqueCompanyNames)) return { ok: false, error: 'uniqueCompanyNames must be an array' }
  const lastUser = [...messages].reverse().find((m) => m?.role === 'user')
  if (!lastUser?.content?.trim()) return { ok: false, error: 'No user message' }
  const names = uniqueCompanyNames.filter((n) => typeof n === 'string' && n.trim() !== '')
  return { ok: true, messages, uniqueCompanyNames: names, lastUserContent: lastUser.content.trim() }
}

function batched(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function askLLM(openai, batchNames, inputCompanyQuery) {
  const systemPrompt = `You are a search helper. Logic:

1. You receive an input company name (what the user selected) and a list of company names that appear in a contact database. The list often contains misspellings, typos, subsidiaries, brands, and informal variants (e.g. "Coke Botling", "Sprite LLC", "Fanta Inc.", "Dasani Co", "Minute Maid").
2. Your job: infer which company each name refers to. For the input company, return EVERY name from the list that refers to that company, including:
   - Official names and misspellings/typos (e.g. "Coca Cola Compnay", "Coke Botling").
   - Subsidiaries, brands, and product names that belong to that company (e.g. for Coca-Cola: include "Sprite LLC", "Fanta Inc.", "Dasani Co", "Minute Maid", and any other names in the list that are known brands or subsidiaries of that company). Use your knowledge of corporate ownership: if a name in the list is a brand or subsidiary of the input company, include it.
3. The list you return is used to find all contact records whose company field is in that list. So you MUST include every name that refers to the input company — do not omit subsidiaries or brands.

Return a JSON object with:
- "matchingCompanyNames": array of names FROM THE PROVIDED LIST that refer to the input company. Copy each name exactly as it appears in the list. Include official names, misspellings, subsidiaries, and brands.
- "explanation": (optional) one short sentence.

Return ONLY valid JSON, no markdown or extra text.`

  const userPrompt = `Input company name / query: ${inputCompanyQuery}\n\nList of company names in the data (may include misspellings and typos; one per line):\n${batchNames.join('\n')}`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 4000,
  })

  const text = completion.choices?.[0]?.message?.content?.trim()
  if (!text) return { matchingCompanyNames: [], explanation: '' }
  try {
    return JSON.parse(text)
  } catch {
    return { matchingCompanyNames: [], explanation: '' }
  }
}

app.post('/api/chat', async (req, res, next) => {
  try {
    const validated = validateBody(req.body)
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error })
    }

    const { uniqueCompanyNames, lastUserContent } = validated

    if (!OPENAI_API_KEY) {
      return res.status(503).json({ error: 'LLM not configured (OPENAI_API_KEY missing)' })
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY })
    const nameSet = new Set(uniqueCompanyNames)
    const allMatches = []
    let explanation = ''

    const batches = batched(uniqueCompanyNames, BATCH_SIZE)
    for (const batch of batches) {
      const result = await askLLM(openai, batch, lastUserContent)
      const matching = Array.isArray(result.matchingCompanyNames) ? result.matchingCompanyNames : []
      for (const name of matching) {
        const s = String(name).trim()
        if (nameSet.has(s)) allMatches.push(s)
      }
      if (result.explanation) explanation = result.explanation
    }
    const matchingCompanyNames = [...new Set(allMatches)]
    return res.status(200).json({ matchingCompanyNames, explanation: explanation || undefined })
  } catch (err) {
    if (err.status === 429) return res.status(429).json({ error: 'Rate limit exceeded' })
    if (err.code === 'ETIMEDOUT') return res.status(504).json({ error: 'Request timeout' })
    if (err.message?.includes('rate')) return res.status(429).json({ error: 'Rate limit exceeded' })
    console.error('[POST /api/chat]', err.message || err)
    next(err)
  }
})

// Catch any unhandled errors in async route (e.g. from OpenAI SDK)
app.use((err, _req, res, _next) => {
  console.error('[server error]', err)
  res.status(500).json({ error: 'Internal server error' })
})

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
