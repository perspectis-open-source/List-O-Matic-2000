# Agentic AI Demo — Implementation Plan (All Three Options)

This plan implements all three agentic enhancements so the demo clearly shows: **tool use** (web search), **visible reasoning** (step-by-step), and **follow-up refinement** (user refines, agent updates).

**Implementation order:** Option 2 (reasoning) → Option 1 (web search tool) → Option 3 (follow-up). Each builds on the previous.

---

## API contract (evolved)

**Request** `POST /api/chat` (unchanged shape; optional new fields for Option 3):

- `messages: { role: 'user' | 'assistant'; content: string }[]` — For follow-up, client may send multiple messages (e.g. initial "Find everyone at Coke" + "Also include bottling plants").
- `uniqueCompanyNames: string[]` — Full list of unique company names from the file (no PII).
- `previousMatchingNames?: string[]` — (Option 3) When refining, send the current matching list so the LLM can expand or narrow.

**Response** (extended for Option 2 and Option 1):

- `matchingCompanyNames: string[]` — As today.
- `explanation?: string` — Optional one-line summary (keep for backward compatibility).
- **`reasoningSteps?: { title: string; detail: string }[]`** — (Option 2) Steps the agent took, e.g. `{ title: "Official names", detail: "Coca-Cola Company, Coke, Coca-Cola Ltd" }`, `{ title: "Subsidiaries / brands", detail: "Sprite LLC, Fanta Inc., Dasani Co" }`, `{ title: "Misspellings", detail: "Coke Botling, Coca Cola Compnay" }`.
- **`toolCalls?: { tool: string; query?: string; summary?: string }[]`** — (Option 1) List of tools the agent used, e.g. `{ tool: "search_web", query: "Coca-Cola subsidiaries and brands", summary: "Found 12 brands including Sprite, Fanta, Dasani" }`. Frontend shows "Agent looked up: …".

---

## Option 2: Visible reasoning (implement first)

**Goal:** Agent returns structured reasoning steps; UI shows "How the agent matched" so the audience sees step-by-step reasoning.

### Backend ([server/index.js](server/index.js))

1. **Extend `askLLM` response schema**  
   In the system prompt, add to the JSON return shape:
   - `"reasoningSteps": array of { "title": string, "detail": string }` — 2–5 short steps, e.g. "Official names", "Subsidiaries/brands", "Misspellings". Instruct: "Be concise; list example names in detail where helpful."

2. **Merge reasoning from batches**  
   When aggregating batch results, keep one set of `reasoningSteps` (e.g. from the first batch that returns steps, or merge by concatenating step titles and merging details). Return in response as `reasoningSteps`.

3. **Response**  
   Ensure `res.json({ matchingCompanyNames, explanation, reasoningSteps })` (reasoningSteps optional so old clients still work).

### Frontend

1. **Types** ([client/src/api/chat.ts](client/src/api/chat.ts))  
   - Extend `ChatResponse`: `reasoningSteps?: { title: string; detail: string }[]`.

2. **State** ([client/src/App.tsx](client/src/App.tsx))  
   - Add `reasoningSteps: { title: string; detail: string }[] | null` (or store on the same object as `matchingCompanyNames` / `explanation`). Set from API response; clear when starting a new search or on error.

3. **UI — "How the agent matched"**  
   In the AI Results tab, when there are results:
   - Below the count + Export row, add a **Paper** or **Box** titled "How the agent matched" (e.g. `Typography variant="subtitle2"`).
   - If `reasoningSteps` exists and length > 0: render a list (e.g. `List`/`ListItem` or stacked `Typography`) showing each step's `title` and `detail`. Keep it scannable (e.g. title bold, detail below or inline).
   - If no reasoning steps (e.g. old API or empty), optionally show only `explanation` or hide the section. Collapsible (e.g. MUI `Collapse` + "Show reasoning") is optional.

### Files to touch

- [server/index.js](server/index.js): prompt update; parse and return `reasoningSteps`; merge across batches.
- [client/src/api/chat.ts](client/src/api/chat.ts): add `reasoningSteps` to `ChatResponse`.
- [client/src/App.tsx](client/src/App.tsx): state for `reasoningSteps`; set from `postChat` response; "How the agent matched" section in AI Results tab.

---

## Option 1: Web search tool (implement second)

**Goal:** Agent can call a `search_web` tool to look up subsidiaries/brands, then match against the provided company name list. UI shows "Agent looked up: …".

### Backend

1. **Search implementation**  
   - **Option A (demo-friendly):** Mock search: a function `mockSearchWeb(query)` that returns a fixed string or a small map of query → snippet (e.g. "Coca-Cola subsidiaries" → "Coca-Cola owns brands: Sprite, Fanta, Dasani, Minute Maid, ..."). No API key required.  
   - **Option B (real):** Use a search API (e.g. Tavily, SerpAPI) with env var `TAVILY_API_KEY` or similar; call it from a `searchWeb(query)` function; return a short snippet (e.g. 500 chars).  
   - Implement in [server/index.js](server/index.js) or a small [server/tools/search.js](server/tools/search.js); keep PII out of queries.

2. **Tool definition for OpenAI**  
   - Define one tool: `search_web`, with parameter `query` (string). Use OpenAI chat completions with `tools: [{ type: "function", function: { name: "search_web", description: "...", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } }]`.

3. **Agent loop**  
   - Send user message + full company list (or batched) in a **single** LLM request that allows tool use.  
   - If the model returns `tool_calls` for `search_web`: execute the tool (mock or real), append the tool result as a message, and call the LLM again with the conversation (user message + assistant message with tool_calls + tool result).  
   - Cap iterations (e.g. max 3 tool rounds) to avoid infinite loops.  
   - When the model returns a final answer (no tool call, or a content block with JSON), parse that content for `matchingCompanyNames`, `explanation`, `reasoningSteps`. If the model returns structured content only after tools, aggregate and return.  
   - **Record tool usage:** For each `search_web` call, push `{ tool: "search_web", query: "<query>", summary: "<short summary or snippet>" }` to an array. Return as `toolCalls` in the response.

4. **Batching vs tools**  
   - Current design batches `uniqueCompanyNames` and calls `askLLM` per batch. With tools, two approaches:  
     - **Simpler:** Run the agent loop once with the **first batch** of names (e.g. 400) and the user message; allow tool use; get back matching names from that batch + reasoning + toolCalls. Then run non-tool `askLLM` for remaining batches with the same prompt (no tools) and merge matching names. Reasoning/toolCalls from the first run only.  
     - **Full agent per batch:** Run the agent loop for each batch and merge; toolCalls could be merged from all batches (may duplicate searches).  
   - Recommend **simpler** for demo: one agentic run on first batch (with tool + reasoning), then batch the rest without tools and merge `matchingCompanyNames`.

5. **Response**  
   - Include `toolCalls` in the JSON response when present.

### Frontend

1. **Types** ([client/src/api/chat.ts](client/src/api/chat.ts))  
   - Add to `ChatResponse`: `toolCalls?: { tool: string; query?: string; summary?: string }[]`.

2. **State** ([client/src/App.tsx](client/src/App.tsx))  
   - Add `toolCalls` (or store with `reasoningSteps`). Set from API response; clear on new search.

3. **UI — "What the agent did"**  
   - In the AI Results tab, when there are results and `toolCalls` length > 0:  
     - Add a short section (e.g. above or below "How the agent matched"): "Agent used tools:" or "Agent looked up:".  
     - For each item: e.g. "Searched the web: \<query\>" and optionally show a one-line summary. Keep it short so the demo narrative is clear.

### Files to touch

- [server/index.js](server/index.js): `searchWeb` (mock or real); tool definition; agent loop (request with tools, handle tool_calls, re-call, parse final answer); record `toolCalls`; merge with other batches if using simplified batching.
- [client/src/api/chat.ts](client/src/api/chat.ts): `toolCalls` on `ChatResponse`.
- [client/src/App.tsx](client/src/App.tsx): state for `toolCalls`; "Agent looked up" / tool use section in AI Results tab.
- Optional: [server/.env.example](server/.env.example): add `TAVILY_API_KEY` or similar if using real search.

---

## Option 3: Follow-up refinement (implement third)

**Goal:** User can type a follow-up (e.g. "Also include bottling plants" or "Exclude subsidiaries"); agent runs again and returns updated `matchingCompanyNames`; UI updates the results table.

### Backend

1. **Request shape**  
   - Already accepts `messages: array`. For refinement, client will send:  
     - First message: "Find everyone that works at Coke"  
     - Second message (user): "Also include anyone at bottling plants"  
   - Optional: accept `previousMatchingNames: string[]` in the body so the LLM can expand or narrow from that set (and still only return names from `uniqueCompanyNames`).

2. **Prompt behavior**  
   - When `messages.length > 1` (or when `previousMatchingNames` is present), set system or user prompt to indicate: "The user is refining the previous result. Previous matching names: ... User's new instruction: ... Return the updated matchingCompanyNames (only from the provided list) and updated reasoningSteps if helpful."  
   - Run the same flow (with or without tools on first batch) and return the new list. No need for a separate endpoint; same `POST /api/chat` with more messages and optional `previousMatchingNames`.

3. **Validation**  
   - Allow multiple user messages; still require at least one user message with content. Optional: cap total messages (e.g. 10) to avoid abuse.

### Frontend

1. **API**  
   - [client/src/api/chat.ts](client/src/api/chat.ts): extend `postChat` to accept optional `previousMatchingNames?: string[]` and send it in the body. Request body: `{ messages, uniqueCompanyNames, previousMatchingNames?: string[] }`.

2. **State**  
   - Keep current state for `matchingCompanyNames`, `reasoningSteps`, `toolCalls`, `explanation`. For refinement, we **replace** these with the new response (so the table and reasoning/tool sections update to the refined result).

3. **UI — Follow-up input**  
   - In the AI Results tab, when there are results (`matchingCompanyNames.length > 0`):  
     - Add a **TextField** (or Input) and a **"Refine"** (or "Ask follow-up") button. Place below the reasoning/tool sections and above the table, or in a sticky bar.  
     - Label: e.g. "Refine results (e.g. ‘Also include bottling plants’ or ‘Exclude subsidiaries’)".  
   - On submit:  
     - Build `messages`: previous conversation (e.g. store the last user message + optional assistant summary) or minimal: `[{ role: 'user', content: initialMessage }, { role: 'user', content: refineInput }]`.  
     - Call `postChat(messages, uniqueCompanyNames, previousMatchingNames)` with `previousMatchingNames = matchingCompanyNames` so the LLM can expand/narrow.  
     - On success: set `matchingCompanyNames`, `reasoningSteps`, `toolCalls`, `explanation` from the response; update the table.  
     - Show loading state during refine request; on error, show Alert and keep previous results.

4. **Conversation history (optional)**  
   - For a multi-turn feel, you can keep a short `conversationMessages` state (e.g. last user message + last assistant summary) and append each refine message + new response. For the first version, sending `[initialMessage, refineMessage]` is enough.

### Files to touch

- [server/index.js](server/index.js): accept `previousMatchingNames` in body; when present (or when messages.length > 1), adjust prompt to refinement mode; validate multiple messages.
- [client/src/api/chat.ts](client/src/api/chat.ts): `postChat(..., previousMatchingNames?: string[])`; include in request body.
- [client/src/App.tsx](client/src/App.tsx): refine input + Refine button; on submit build messages and call API with `previousMatchingNames`; update state from response; loading and error handling.

---

## Implementation order summary

| Phase | Option | Backend | Frontend |
|-------|--------|---------|----------|
| 1 | 2. Visible reasoning | Prompt + return `reasoningSteps`; merge across batches | `ChatResponse.reasoningSteps`; "How the agent matched" section |
| 2 | 1. Web search tool | `search_web` (mock or API); tool def; agent loop; return `toolCalls` | `ChatResponse.toolCalls`; "Agent looked up" section |
| 3 | 3. Follow-up | Accept `previousMatchingNames` + multi-message; refinement prompt | Refine input + button; `postChat(..., previousMatchingNames)`; update results |

---

## Demo narrative (all three)

1. **Upload & select** — "We have 25,000 contacts; I select Coke."
2. **AI Search** — "The agent can search the web for Coca-Cola subsidiaries [point to tool use], then it shows how it matched: official names, subsidiaries, misspellings [point to reasoning steps]. Here are the 1,000 contacts."
3. **Refine** — "I can refine: I type ‘Also include bottling plants’ and click Refine — the agent updates the list."

---

## Edge cases and notes

- **Backward compatibility:** If the backend doesn’t return `reasoningSteps` or `toolCalls`, frontend should not break (optional chaining / hide sections when absent).
- **PII:** No contact rows or PII in tool queries or prompts; only company names and search results.
- **Rate limits:** Agent loop (Option 1) may make 2–4 LLM calls per search; consider timeout and rate-limit handling.
- **Mock search:** For a demo without a search API key, mock search is sufficient and still demonstrates "the agent used a tool."

---

## Production and durability

To make the agentic flow durable and production-grade, implement the following in addition to the feature steps above.

### Security

- **Input validation**
  - **messages:** Require at least one user message with non-empty content. Cap total messages (e.g. `MAX_MESSAGES = 10`) and per-message content length (e.g. 2000 chars) to prevent abuse and bound prompt size.
  - **previousMatchingNames:** If present, validate that every entry is in `uniqueCompanyNames` (or reject the request). Prevents the LLM from being given arbitrary data.
  - **uniqueCompanyNames:** Keep existing validation (array of strings, reasonable length/cap as in main PLAN).
- **Search tool**
  - **Query sanitization:** Truncate or reject search `query` if length exceeds a limit (e.g. 200 chars). Do not pass user-controlled content that could inject instructions (treat query as plain search text).
  - **No PII in queries:** Ensure only company-related search phrases are built (no names, emails, or phone numbers).
  - **Real search API:** Store API key in env only; do not log query content in production if it could contain sensitive terms. Optional: rate-limit search tool calls per request (e.g. max 3) and per IP if needed.
- **Output**
  - **Response sanitization:** Continue to filter `matchingCompanyNames` so the response contains only names that appear in the request’s `uniqueCompanyNames`. Apply after every path (single call, agent loop, refinement).
  - **reasoningSteps / toolCalls:** Cap array length (e.g. 20 steps, 10 tool calls) and truncate `title`/`detail`/`summary`/`query` (e.g. 500 chars each) so response size is bounded. Frontend should render as plain text (React escapes by default; avoid `dangerouslySetInnerHTML`).

### Reliability

- **Timeouts**
  - Set an **overall request timeout** for `POST /api/chat` (e.g. 60–90 seconds) so the client doesn’t hang when the agent loop or batches are slow.
  - Set **per–LLM-call timeout** (e.g. 30s) and **per–tool-execution timeout** (e.g. 10s for real search). On timeout, return a 504 or 503 with a generic message and do not expose internals.
- **Agent loop**
  - **Max iterations:** Cap tool-use rounds (e.g. 3) to avoid runaway loops. If cap is reached before the model returns a final answer, treat the last content as the answer or return a safe fallback (e.g. empty matches + explanation "Agent did not complete in time").
  - **Tool failure:** If `search_web` throws (e.g. search API down), inject a short error message into the conversation and let the model continue without that result, or return a 503. Prefer degrading gracefully (return matches from model knowledge only) over failing the whole request when possible.
- **Refinement**
  - Use the same response sanitization: returned `matchingCompanyNames` must be a subset of `uniqueCompanyNames`.

### Observability

- **Logging**
  - Log request metadata: e.g. message count, presence of `previousMatchingNames`, number of `uniqueCompanyNames`, and (optionally) agent loop iteration count and tool call count. Do **not** log full message content or PII.
  - On error, log error type and message (and status code) without leaking prompt or response content.
- **Health**
  - Existing `GET /health` is sufficient. Optional: a readiness check that verifies OPENAI_API_KEY (and TAVILY_API_KEY if used) is set.

### Configuration

- **Environment**
  - Document in [server/.env.example](server/.env.example): `OPENAI_API_KEY`, `TAVILY_API_KEY` (optional), and optional `MAX_AGENT_ITERATIONS=3`, `CHAT_REQUEST_TIMEOUT_MS=90000`. Use defaults in code when not set.
- **Validation constants**
  - Define and document caps (max messages, max message length, max reasoning steps, max tool calls) in one place so they can be tuned for production.

### Testing

- **Backend**
  - **Unit:** Validation rejects invalid `previousMatchingNames` (names not in `uniqueCompanyNames`); rejects over-long messages or too many messages; response sanitization only returns names from the request; mock search returns expected shape.
  - **Integration:** Agent loop with mock tool: one tool call returns; final response has `matchingCompanyNames`, `reasoningSteps`, `toolCalls`. Refinement with `previousMatchingNames` returns valid subset.
- **Frontend**
  - **Unit:** Chat response with missing `reasoningSteps`/`toolCalls` does not crash; sections hide when arrays are empty.
  - **E2E (optional):** AI Search → see reasoning steps; refine → see updated results.

### Summary

| Area | Action |
|------|--------|
| Security | Validate and cap messages and previousMatchingNames; sanitize search query; sanitize response matchingCompanyNames; cap and truncate reasoningSteps/toolCalls. |
| Reliability | Request and per-call timeouts; cap agent iterations; graceful tool failure; same response sanitization for refinement. |
| Observability | Log metadata (no PII); optional readiness check. |
| Config | .env.example and optional timeouts/caps. |
| Testing | Validation, sanitization, mock tool, refinement flow. |

With these in place, the agentic plan is durable and suitable for production use beyond a one-off demo.
