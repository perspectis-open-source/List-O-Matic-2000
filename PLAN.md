# List-O-Matic 2000 — Full build plan

This document is the **single source of truth** for rebuilding the application from scratch. Follow sections 1–18 in order. A builder (human or AI) can recreate the complete app using only this file and the repo README for quick reference.

---

## 1. Product overview and constraints

**What the app does**

- User uploads a contact list (CSV or Excel). The app parses it in the browser and shows the data in a **Contacts** tab.
- User selects a company from an autocomplete (unique company names from the file).
- User clicks **AI Search**. The frontend sends **only** the list of unique company names (no contact rows, no PII) to the backend. The LLM returns which of those names match the selected company (parent, subsidiaries, brands, misspellings).
- The frontend filters the **local** contact list by the returned names and shows the result in an **AI Results** tab. No chat UI—only a button-triggered flow.

**PII rule**

- Contact rows (names, emails, phones, etc.) **never** leave the client. Only the array of **unique company name strings** is sent to the API.

**Scalability**

- Backend batches large company-name lists (e.g. 400 per batch). The first batch may use an agent loop with an optional web-search tool; remaining batches use a single LLM call. Results are merged and sanitized (only names from the request are returned).

---

## 2. Tech stack and repo layout

**Monorepo**

- Root contains `client/` and `server/`.

**Client**

- React 19, Vite 7, TypeScript.
- MUI (Material-UI) 7, Emotion (react + styled).
- react-dropzone, papaparse, xlsx.
- @tanstack/react-virtual for the table body (virtualized list).
- **Do not add ag-grid.** The table is implemented with MUI + @tanstack/react-virtual only.

**Server**

- Node (ESM), Express, cors, dotenv, openai SDK. Default port 3001.

**Testing**

- Vitest (unit/component), Storybook (React-Vite), Playwright (E2E, Chromium). All test configs live in the client (vite.config.ts, playwright.config.ts, .storybook/).

---

## 3. Setup and run instructions

**Prerequisites**

- Node.js 18+, npm or pnpm.

**Client**

```bash
cd client
npm install
npm run dev
```

- Dev server at http://localhost:5173. Vite proxies `/api` to http://localhost:3001.

**Server**

```bash
cd server
cp .env.example .env
```

- Edit `.env`: set `OPENAI_API_KEY`, `CORS_ORIGIN` (e.g. http://localhost:5173), `PORT` (e.g. 3001).
- Then: `npm install && npm run dev`.

**Env (server)**

| Variable | Required | Description |
|----------|----------|-------------|
| OPENAI_API_KEY | Yes | OpenAI API key |
| CORS_ORIGIN | Yes | Frontend origin (e.g. http://localhost:5173) |
| PORT | No | Server port (default 3001) |
| MAX_AGENT_ITERATIONS | No | Max tool-use rounds per request (default 3) |
| TAVILY_API_KEY | No | Optional; if not set, mock search is used |

**NPM scripts**

- **Client**: dev, build, test, test:run, test:coverage, storybook, test:e2e, generate-contacts, lint, preview.
- **Server**: dev, start, test.

---

## 4. File structure

```
client/
  src/
    main.tsx
    App.tsx
    theme.ts
    index.css
    components/     # UploadDropZone, CompanySelect, ContactsTable, LMASpinner
    utils/          # parseFile.ts, exportCsv.ts, companyDescriptions.ts
    api/            # chat.ts
    data/           # crmCompanies.ts (optional)
    test/           # setup.ts, utils.tsx, fixtures.ts
  e2e/
    upload-and-ai-search.spec.ts
    smoke.spec.ts
    fixtures/
      sample-contacts.csv
  scripts/
    generate-contacts.js
  .storybook/
    main.ts
  public/
  vite.config.ts
  playwright.config.ts
  eslint.config.js
  package.json

server/
  index.js
  .env.example
  package.json
```

**Key files**

- **Client**: App.tsx (main UI and state), theme.ts (MUI theme), parseFile.ts, exportCsv.ts, chat.ts, UploadDropZone, CompanySelect, ContactsTable, LMASpinner. Optional: companyDescriptions.ts (exists for future use; current app does not wire it into the UI or export).
- **Server**: index.js (single entry; POST /api/chat, GET /health).

---

## 5. Core data and parsing (client)

**ContactRow**

- Type: `Record<string, string>`. Headers = keys from the first row.

**CSV**

- `Papa.parse(file, { header: true, skipEmptyLines: true })`. Headers from `result.meta?.fields` or `Object.keys(data[0])`. Data = array of objects.

**Excel**

- `XLSX.read(file, { type: 'array' })`, first sheet, `XLSX.utils.sheet_to_json(sheet, { defval: '' })`. Same shape as CSV.

**Column detection**

- **Company column**: First header in this list that exists: `['Company', 'company', 'Organization', 'organization', 'Employer', 'employer']`. Return the key or null.
- **Entity column**: First header in this list that exists: `['Entity', 'entity', 'Company Entity', 'company entity', 'Canonical Company', 'canonical company']`. Return the key or null.

**parseContactFile(file)**

- If `file.name` ends with `.xlsx`, use Excel path; else use CSV. Return `{ data, headers, companyColumnKey, entityColumnKey }`. If no company column, UI still shows the table but AI Search is disabled.

---

## 6. Styling and theme (client)

**MUI**

- Wrap app in ThemeProvider and CssBaseline. Theme from `getAppTheme(mode: 'light' | 'dark')`.

**Design tokens**

- Slate: 50 #F8FAFC, 400 #94A3B8, 500 #64748B, 600 #475569, 700 #334155, 800 #1E293B, 900 #0F172A.
- Primary: Sky 400 #38BDF8 (dark mode), Sky 600 #0284c7 (light mode).
- ACCENT_TINT rgba(56,189,248,0.1), ACCENT_BORDER rgba(56,189,248,0.3).
- PURPLE #A855F7, EMERALD #10B981, ROSE #F43F5E.
- Fonts: body `"Inter", sans-serif`; heading `"Space Grotesk", "Inter", sans-serif`.

**Theme**

- shape.borderRadius 8. Palette: primary (Sky 400/600), secondary (SLATE_600), background/text/divider for light and dark. divider = SLATE_700.

**Component overrides**

- MuiCssBaseline: body fontFamily; `*:focus-visible` outline 2px primary.
- MuiAppBar: backgroundColor SLATE_900, borderBottom SLATE_700, color SLATE_50.
- MuiButton / MuiIconButton: focus-visible outline; containedPrimary uses primary main and contrast.
- MuiTab: minHeight 48, no textTransform; focus-visible outline.
- MuiTabs: minHeight 48, indicator primary, height 3.
- MuiPaper: dark mode background SLATE_800, border SLATE_700.
- MuiAlert: standardInfo/Success/Error left border 4px.
- MuiChip colorPrimary: ACCENT_TINT bg, ACCENT_BORDER border.

**Theme persistence**

- localStorage key `themeMode` ('light' | 'dark'). Toggle in AppBar; restore on load.

**LMASpinner**

- LMA-style CircularProgress (e.g. blue #3F47AA). Used during upload/parse and during AI Search loading state.

---

## 7. Main UI and flows (client)

**Entry (no file loaded)**

- Empty state: "Get started", short description, "Upload file" button (data-testid: upload-trigger). Click opens UploadDropZone (dialog with dropzone). Accept .csv and .xlsx only.

**After upload**

- Toolbar: fileName, row count, company column key (or "No company column"). CompanySelect (autocomplete; options = unique company names from contacts; data-testid: company-select-input). "AI Search" button (data-testid: ai-search-button); disabled when no company selected or when loading.

**Tabs**

- Tab 1: **Contacts** (data-testid: tab-contacts). Full import list. "Export list" button (data-testid: export-import-list-button). Virtualized ContactsTable.
- Tab 2: **AI Results** (data-testid: tab-ai-results). Empty state until first AI Search: "Select a company and click AI Search to see matching contacts here." After search: count ("N contacts matching your search"), optional "How the agent matched" accordion (reasoningSteps), "List entries matched to parent company" accordion with checkboxes to exclude names, "Set company name for all results" text field + Apply, "Export results" button (data-testid: export-results-button), "Remove records from Import List" button (data-testid: remove-from-import-button), virtualized table.

**ContactsTable**

- Virtualized (@tanstack/react-virtual), sortable by column (TableSortLabel per header). Headers from props. Row height 48. For header "Parent company", use wider min width (e.g. minmax(240px, 1fr)).
- **Tooltips**: Only the **"Parent company"** column gets a Tooltip: when the header is "Parent company" and the cell has a value, show a Tooltip with the **cell value** (same as the cell content). No tooltip on the Company column; no "[Company name] company name." or "Entity: ..." in the current app.

**AI Results table**

- Same ContactsTable. Headers = **original upload headers + 'Parent company' only** (no Description column). Rows = displayed result rows; each row has 'Parent company' = inferredParentCompany from the API, and optionally the Company column overridden by "Set company name for all results" when applied. Export uses the same headers and rows (no Description column). The module companyDescriptions.ts exists but is not used in the current app; do not wire it into headers or export for an identical rebuild.

**Client and Refine**

- The **client** sends exactly **one** user message per AI Search: `postChat([{ role: 'user', content: `Find everyone that works at ${company}` }], uniqueCompanyNames)`. There is **no** Refine input or button; no previousMatchingNames or originalCompany sent. The server may still accept those fields for API completeness.

**Remove records from Import List**

- Button removes the currently displayed AI result rows from the contacts state and switches to the Contacts tab. Row count in Contacts decreases accordingly; AI Results tab still shows the same result set when switched back (persisted in state).

**LLM search dialog**

- While `aiSearchLoading` is true, show a modal dialog (data-testid: llm-search-dialog): title "LLM searching..." with a small CircularProgress. Body: a log area showing lines from processLogLines. Initial line: "LLM: Starting...". Then append lines at ~700 ms interval: "LLM: Connecting...", "LLM: Sending company list (N names)...", "LLM: Identifying parent company...", "LLM: Looking up subsidiaries and brands...", "LLM: Matching subsidiaries and variants to your list...", "LLM: Checking misspellings and name variants...", "LLM: Validating matches...", "LLM: Preparing response...", "LLM: Finalizing results...". On success append "LLM: Complete."; on error append "LLM: Error — {message}". The log area has a **shimmer animation** (CSS keyframes, gradient overlay, e.g. 2.5s ease-in-out infinite). Below the log, show warning text: **"LLM results may be incorrect or inaccurate. Please check results."**

---

## 8. API contract (server)

**Route**

- POST /api/chat

**Request body**

- `messages`: array of `{ role: 'user' | 'assistant', content: string }`. Max 10 messages; each content max 2000 chars. Must have at least one user message with non-empty content.
- `uniqueCompanyNames`: array of strings (required). Trimmed non-empty strings used.
- `previousMatchingNames`: optional array; must be subset of uniqueCompanyNames (used for refinement).
- `originalCompany`: optional string (used for refinement).

**Response (200)**

- `matchingCompanyNames`: string[] (only names that appear in the request's uniqueCompanyNames).
- `explanation`: optional string.
- `parentCompany`: optional string | null (inferred parent).
- `reasoningSteps`: optional array of `{ title: string, detail: string }`.

**Errors**

- 400: validation (e.g. messages not array, no user message, uniqueCompanyNames not array).
- 413: body too large (express.json limit 2MB).
- 429: rate limit.
- 503: OPENAI_API_KEY missing.
- 500: generic. CORS from env; express.json({ limit: 2 * 1024 * 1024 }).

---

## 9. Server logic (backend)

**Validation (validateBody)**

- Reject if body missing or not object. Require messages (array, length ≤ 10, each content ≤ 2000), uniqueCompanyNames (array). Last user message must have non-empty content. Build nameSet from uniqueCompanyNames (trimmed strings). If previousMatchingNames present, filter to names in nameSet. Return { ok: true, messages, uniqueCompanyNames (filtered), lastUserContent, previousMatchingNames, isRefinement, originalCompany } or { ok: false, error }.

**Batching**

- Split uniqueCompanyNames into chunks of 400 (BATCH_SIZE). Process first batch with runAgentLoop (with search_web tool); process remaining batches with askLLM (no tools). Merge matchingCompanyNames from all batches; sanitize so every returned name is in the request's uniqueCompanyNames set (use canonical casing from request). After merge, call addParentSuffixVariants(nameList, parentCompany, allMatches) to add any list entry that is parent or parent + legal suffix (Inc, Corp, Ltd, Co, LLC, etc.). Return single response with merged matchingCompanyNames, one explanation, one reasoningSteps (e.g. from first batch that returns them).

**LLM (askLLM)**

- Model: gpt-4o-mini. response_format: { type: 'json_object' }. System prompt: infer parentCompany (official legal name), list subsidiariesAndBrands/inferredBrands, then match from the list only—output matchingCompanyNames (exact copies from list), explanation, reasoningSteps. Legal suffixes: Inc., Inc, Corp., Corp, Ltd., Ltd, Co., Co, LLC, Limited, Computer (use for getCoreCompanyName and addParentSuffixVariants so parent+Corp/Ltd/Inc from the list are always included even if LLM omits them).

**Agent (runAgentLoop, first batch only)**

- Same system prompt plus: you may call search_web with a query like "[Parent company] subsidiaries and brands". Tool: name search_web, parameter query (string). Mock implementation can return a fixed string; optional TAVILY_API_KEY for real search. MAX_AGENT_ITERATIONS = 3. When model returns JSON (no more tool calls), parse and return same shape as askLLM.

**parseLLMJson**

- Strip optional markdown code block (```json ... ```); JSON.parse. Extract parentCompany, matchingCompanyNames (or matching_names), explanation, reasoningSteps, inferredBrands.

**Health**

- GET /health returns 200 JSON { ok: true }.

---

## 10. Client API (chat.ts)

**postChat(messages, uniqueCompanyNames, previousMatchingNames?, originalCompany?)**

- POST to `${API_BASE}/api/chat` (API_BASE = import.meta.env.VITE_API_URL ?? ''). Body: { messages, uniqueCompanyNames }; if previousMatchingNames/originalCompany provided, include them. Content-Type application/json. Return response JSON as Promise<ChatResponse>. ChatResponse: matchingCompanyNames, parentCompany?, explanation?, reasoningSteps?.
- **Current app usage**: The app calls postChat with **two arguments only**: messages (array with one user message) and uniqueCompanyNames. The function may still accept optional third and fourth arguments for server API compatibility.

---

## 11. Export (client)

**sanitizeFilenameSegment(segment)**

- Remove path chars and control chars; collapse spaces; trim; cap length 200. If result empty or Windows-reserved (CON, PRN, AUX, NUL, COM1–9, LPT1–9), return 'search'.

**toCsvString(data, headers)**

- Build CSV from ContactRow[] and headers. For each cell, if value starts with =, +, -, @, tab, or CR, prefix with tab (formula-injection mitigation). Use Papa.unparse with columns: headers.

**downloadCsv(data, headers, filename)**

- Prepend UTF-8 BOM (\uFEFF) to CSV string; create Blob; createObjectURL; programmatic anchor click with download=filename; revokeObjectURL. Export results filename: ai-results-{sanitizeFilenameSegment(company)}-{date}.csv. Export import list: {sanitizeFilenameSegment(fileNameWithoutExt)}-{date}.csv.

---

## 12. Demo data generator

**Script**

- client/scripts/generate-contacts.js (ESM). Output: client/public/demo-contacts-25k.csv. Use path and fs; __dirname via path.dirname(fileURLToPath(import.meta.url)).

**Spec**

- 25 companies, 1,000 contacts each (25,000 rows). **Columns: Name, Email, Company, Phone only** (no Entity column). 15 companies start with "C": Coke, Colgate, Costco, Cadbury, Caterpillar, Comcast, Chevron, Chrysler, Citigroup, Cisco, Campbell's, Conagra, Cardinal Health, Cigna, CVS. 10 non-C: PepsiCo, Unilever, Amazon, Microsoft, Apple, Walmart, Target, Ford, Disney, Netflix. Each company has 8–20 name variants including typos/misspellings; assign each row a company name by sampling from that company's variant list. Generate names/emails/phones (e.g. first name, last name, email from template, phone placeholder). Write CSV with header row then data rows; escape cells that contain comma, quote, or newline.

**Run**

- From client: `npm run generate-contacts`.

---

## 13. Testing — unit and component (Vitest)

**Config (vite.config.ts)**

- test.globals true, environment 'jsdom', setupFiles './src/test/setup.ts', include 'src/**/*.{test,spec}.{ts,tsx}', exclude e2e and node_modules. coverage provider v8, reporter text and html, include src/**/*.{ts,tsx}, exclude src/test, **/*.stories.*, e2e.

**Setup (src/test/setup.ts)**

- Import '@testing-library/jest-dom/vitest'.

**Render helper (src/test/utils.tsx)**

- Custom render that wraps UI in ThemeProvider with getAppTheme('light') and CssBaseline. Re-export everything from @testing-library/react; export custom render as render. Use type-only import for ReactElement if verbatimModuleSyntax is enabled.

**Fixtures (src/test/fixtures.ts)**

- mockContacts: array of ContactRow (e.g. 3 rows with Name, Email, Company). mockHeaders: ['Name', 'Email', 'Company'].

**Tests**

- parseFile: detectCompanyColumnKey, detectEntityColumnKey, parseCSV, parseContactFile (file type dispatch, column keys).
- exportCsv: sanitizeFilenameSegment, toCsvString, downloadCsv (mock URL.createObjectURL/revokeObjectURL).
- api/chat: postChat with mocked fetch; assert request body and response shape.
- CompanySelect, UploadDropZone, ContactsTable: smoke and key behavior. For CompanySelect options use getByRole('option', { name: '...' }).

---

## 14. Testing — Storybook

**Config (.storybook/main.ts)**

- stories '../src/**/*.stories.@(js|jsx|ts|tsx)', addons addon-essentials and blocks, framework @storybook/react-vite. Preview should use MUI theme (e.g. decorator with ThemeProvider).

**Stories**

- One per component: UploadDropZone, CompanySelect, ContactsTable, LMASpinner. Use Meta and StoryObj; args for props; document that preview wraps with theme.

---

## 15. Testing — E2E (Playwright)

**Config (playwright.config.ts)**

- testDir 'e2e', project chromium (Desktop Chrome), baseURL from PLAYWRIGHT_BASE_URL or http://localhost:5173, webServer command 'npm run dev', url http://localhost:5173, reuseExistingServer when not CI. fullyParallel true, forbidOnly in CI, retries 2 in CI.

**Fixtures**

- e2e/fixtures/sample-contacts.csv: CSV with header Name, Email, Company and 3 rows (e.g. 2x Acme Inc, 1x Globex Corp). In specs, resolve path with ESM __dirname: `const __dirname = path.dirname(fileURLToPath(import.meta.url))`; fixture path `path.join(__dirname, 'fixtures', 'sample-contacts.csv')`.

**Mock response**

- For route **/api/chat**, fulfill with JSON: { matchingCompanyNames: ['Acme Inc'], parentCompany: 'Acme Corp', reasoningSteps: [] }. With sample-contacts (2 Acme Inc, 1 Globex), AI Results will show 2 contacts matching; "Remove records from Import List" removes those 2 from the contact list so Contacts tab shows 1 row.

**Specs**

1. **Smoke**: goto '/'; expect title to match /List-O-Matic 2000/; expect element with data-testid main-content visible; expect data-testid upload-trigger visible.
2. **Upload + AI Search**: click upload-trigger; setInputFiles to fixture; expect main-content to contain fileName and "3 rows"; click company-select-input; click getByRole('option', { name: 'Acme Inc' }); route /api/chat with mock; click ai-search-button; click tab "AI Results"; expect "contacts matching your search" and export-results-button visible.
3. **Contacts Export list**: after upload, expect tab-contacts and export-import-list-button visible with text "Export list".
4. **Remove records**: after AI Search and 2 results, click remove-from-import-button; expect tab Contacts and "1 row"; switch to AI Results; expect "2 contacts matching" and export-results-button still visible.
5. **LLM dialog**: during AI Search, expect dialog (data-testid llm-search-dialog) visible with text matching "LLM results may be incorrect or inaccurate" and "Please check results."

**data-testid list**

- upload-trigger, main-content, company-select-input, ai-search-button, tab-contacts, tab-ai-results, export-results-button, export-import-list-button, remove-from-import-button, llm-search-dialog.

---

## 16. Security and robustness

**Server**

- No PII in logs. Sanitize response matchingCompanyNames to the request's set only. CORS origin from env. Body size limit. Map 429 and timeouts to appropriate status. Catch entity.too.large (413).

**Client**

- Formula-injection mitigation on export (tab prefix for cells starting with =, +, -, @, tab, CR). Filename sanitization. Never send contact rows or PII in API payload.

---

## 17. Production hardening

When deploying to production, implement the following so the system is robust, observable, and safe under load.

**Timeouts**

- Set an explicit timeout on each LLM request (e.g. 30–60 seconds). If the LLM or agent does not respond in time, return 504 Gateway Timeout or 503 and a safe error message to the client. Do not leave requests hanging indefinitely.

**Retries**

- Define a retry policy for transient upstream failures (e.g. OpenAI 429 or 5xx). Either: retry with backoff (e.g. exponential, max 2–3 attempts) and then return 502/503, or document "no retries" and return 502/503 on first failure. Avoid unbounded retries.

**Rate limiting**

- Apply rate limiting to POST /api/chat (e.g. per IP or per API key) to protect the backend and the LLM from abuse. Return 429 when the limit is exceeded. If auth is added later, rate limit per user or tenant.

**Logging**

- Log request-level metadata that does not include PII: e.g. request id, timestamp, uniqueCompanyNames count, batch count, response status, duration, and error type. Never log contact rows, names, emails, or the full list of company names. Use structured logs (e.g. JSON) for production.

**Input limits**

- Optionally cap the length of uniqueCompanyNames (e.g. 10,000–20,000) and the length of each company name string (e.g. 500 characters) to bound cost and payload size. Reject with 400 and a clear message if exceeded.

**Health and readiness**

- Keep GET /health returning { ok: true } for liveness. Optionally add a readiness check that verifies OPENAI_API_KEY is set and (if desired) that the LLM provider is reachable; return 503 when not ready so load balancers can avoid the instance.

**Production API URL**

- In production, the client may be served from a different origin. Set VITE_API_URL at build time so the client calls the correct API base URL, or use a reverse proxy so /api is same-origin and no client change is needed.

**Stack versions**

- The plan pins specific stack versions (e.g. React 19, Vite 7). When upgrading, re-run tests and update the plan if behavior or constraints change. The constraints and security rules in this document take precedence over version numbers.

---

## 18. Out of scope

- Google Sheets import; user authentication; streaming LLM responses; sending any PII to the server; editing or deleting individual contact rows (only the "Remove records from Import List" bulk action is in scope).
