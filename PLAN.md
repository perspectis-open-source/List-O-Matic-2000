---
name: Contacts upload app
overview: "Marketing-demo app: upload a contact list (with varied company names, e.g. Coke/Coca-Cola), search/select a company, then click AI Search to find everyone at that company. Only unique company names (no PII) are sent to the LLM; the LLM returns which company names match; the frontend filters the contact list locally and shows results in a second tab. No chat UI; AI Search is triggered by a button when a company is selected. PII never leaves the client; context stays small and scalable."
---

# Marketing Demo: Contact List + AI Agent (React + Backend)

## Living document — How to use this plan

This plan is intended for **another person or an LLM** to build the application. Use it as the single source of truth.

- **Read the full plan first** to understand the demo goal, constraints (no PII to LLM, batching), and architecture.
- **Build in order**: Follow **Implementation steps 1–9** in sequence. Each step references tech choices, file structure, and (where relevant) the Production and robustness section.
- **File structure**: Create the folders and files under **File structure (suggested)**. Keep client and server in one repo (monorepo) unless you prefer separate repos.
- **When in doubt**: Prefer the plan's wording — e.g. API contract (request/response), validation rules, PII handling, and test coverage. If something is ambiguous, choose the option that matches the Demo goal and PII/scalability constraints.
- **Updating the plan**: As you build, you may add implementation notes, decisions, or links (e.g. "Implemented in commit X" or "Column key stored in state as `companyColumnKey`"). Keep the plan in version control so it stays a living document.

---

## Demo goal

Show how AI can help marketing: **upload a contact list** (25,000 contacts across **25 companies**, 1,000 per company, with varied official names and misspellings per company). User **searches and selects a company** (e.g. Coke), then clicks **AI Search**. The **agent** identifies that company's name variants; the **frontend** filters locally and displays the matching contacts in a **second tab**. **Same file and app support the demo for all 25 companies.** There is **no chat feature** — only company search/select and an AI Search button.

## Demo flow (on-stage)

1. **Drag and drop the file into the app** — User drops the contact CSV/Excel onto the drop zone; the table loads and shows the contacts (25,000 rows across 25 companies) in the **first tab (Contacts)**. **Contact list (PII) stays in the browser** and is never sent to the server or LLM.
2. **Search and select company** — User types in the company search and selects one (e.g. "Coke" or "Coca-Cola Company").
3. **AI Search** — User clicks the **AI Search** button. Frontend sends only the **list of unique company names** (no names, emails, or other PII) to the backend, with a synthetic message like "Find everyone that works at [selected company]". The LLM returns the **subset of company names** that match. Frontend **filters the local contact list** by those names and displays the **matching contacts in a second tab** (e.g. "AI Results" or "Results"). LLM does the reasoning; row filtering is local so **no PII leaves the client**.

## PII and scalability (constraints)

- **No PII to the LLM**: The contact list contains names, emails, phones — **do not send it to the backend or LLM**. Only send **company name data** (e.g. the list of unique values in the Company column). The LLM returns which of those company names match the user's query (e.g. "Coke"); the frontend filters the contact list locally and displays results.
- **Scalable context**: With 25,000 rows, sending full contact data would be a huge context and not scalable. Sending only **unique company names** keeps the prompt small; **batching** handles large name lists at scale.

## Maximize LLM use (AI demo principle)

This is an **AI demo**: the value is showing what the model can do, so **maximize the use of the LLM** within the constraint that only company names (no PII) are sent.

- **Let the LLM do**: deciding which company names in the list count as "Coke" (Coca-Cola, regional entities, brands, misspellings) and returning that subset; explaining which names it treated as Coke. The backend sends only the **unique company names** in the prompt; the LLM returns the matching company names (and optional explanation).
- **Frontend does**: extract unique company names from the contact list, send them to the API, then **filter the local contact list** by the returned company names and display the matching rows (and summary). No PII leaves the client.
- **Avoid**: sending contact rows (PII) or full contact list to the LLM; hard-coded company lists for matching. Optional: give the LLM a **web search** tool so it can look up "Coca-Cola subsidiaries" and then match against the company name list.
- **Prompt design**: System prompt should say the model receives a list of company names (no other data) and must return which of those names correspond to the user's query (e.g. Coke), with optional reasoning.

## Goal

- **Contacts**: Drag-and-drop CSV/Excel; parse and display in a table in the **first tab** (frontend-only parsing). Contact list stays in the browser; **never send PII to the backend or LLM**.
- **Company search + AI Search**: User **searches/selects a company** from the unique company list. When user clicks **AI Search**, frontend sends only **unique company names** and a query derived from the selected company; LLM returns which company names match; frontend filters the contact list locally and displays **all matching contacts in a second tab**. No chat UI. API key stays on the backend.

## Tech choices

- **Frontend**: React (Vite), `papaparse`, `xlsx`, `react-dropzone`, **MUI (Material-UI)** for a professional look. **Theming**: dark and light mode with **bright green** as the accent/primary color (demo-friendly, high visibility).
- **Testing**: **Vitest** (or Jest) for unit/integration tests (frontend and backend); **Storybook** for component documentation and visual testing; **Playwright** for end-to-end tests. Full test suite organized under client and server with clear boundaries (see File structure and Test suite section).
- **Backend**: Node + Express (or Fastify) to proxy LLM requests and hold the API key
- **LLM**: Use **OpenAI** (or another provider; pick one at implementation time). API key in backend env (e.g. `OPENAI_API_KEY`); backend sends only company names to the LLM and returns matching company names (structured JSON). Optional: web-search tool for subsidiary lookup.
- **Repo layout**: Single **monorepo** with `client/` and `server/` at the root unless the team prefers separate repos.

## Architecture overview

- **Contacts**: Parsed in the browser and shown in the **Contacts** tab. **Contact list never leaves the client.** Frontend derives the list of **unique company names** and sends only that (no PII) when the user clicks AI Search.
- **AI Search**: User selects a company, then clicks **AI Search**. Frontend sends `{ messages, uniqueCompanyNames }` (e.g. one user message: "Find everyone that works at [selected company]"). Backend builds a prompt with only the company names; LLM returns which names match. Frontend receives the matching company names, filters the **local** contact list, and displays the results in a **second tab** (e.g. "AI Results"). API key stays on the server. **No chat window** — only the button triggers the request.

## Core flows

**Contacts (frontend only)**

1. User drops or selects a file (`.csv` or `.xlsx`).
2. App reads the file (e.g. `FileReader`), then: `.csv` → Papa Parse → array of objects (first row = keys). `.xlsx` → xlsx library → same shape (first row = headers).
3. Store result in React state and render a table; columns = object keys so any contact columns (name, email, phone, etc.) show automatically.

**AI Search (frontend + backend, company names only — no PII)**

1. User has already uploaded a contact list (table visible in **Contacts** tab). User **searches and selects a company** (e.g. Coke) from the company search/select.
2. User clicks **AI Search**. Frontend derives **unique company names** from the contact list and builds a synthetic user message (e.g. "Find everyone that works at [selected company]"). Sends `POST /api/chat` with body `{ messages, uniqueCompanyNames }` — **no contact rows, no names, no emails**.
3. Backend builds a prompt with only the list of company names and that message. Calls the LLM; LLM returns the **subset of company names** that match. Backend returns `{ matchingCompanyNames: string[], explanation?: string }` to the frontend.
4. Frontend filters the **local** contact list where Company is in `matchingCompanyNames` and displays **all matching contacts in a second tab** (e.g. "AI Results"). Optionally show count/summary in that tab. PII never left the client.

## Demo scenario (25 companies, reusable for any company)

- **Sample file**: **25,000 contacts** total across **25 companies**. Each company has **1,000 contacts** with the **same naming convention**: a mix of official names, subsidiaries, **misspellings**, and **typos** for that company. **Create a new demo file** (replace the old one) with the company list and conventions below.
  - **One company is Coke**: 1,000 rows with varied Coke names (Coca-Cola Company, Coca-Cola Ltd, Coke Bottling, Fanta Inc., "Coca Cola", "Coke Botling", "Coca Cola Compnay", etc.) — include **typos and misspellings** in the variant list.
  - **The other 24 companies**: 1,000 contacts each (24 × 1,000 = 24,000). For each company, use the same convention: multiple official/variant names plus **misspellings and typos** (e.g. "Colgate-Palmoliv", "Costco Wholsale", "Cadbury Schweppes" misspelled, etc.).
  - **15 companies start with "C"**: So that searching for **Coke** (or any C company) is non-trivial, **15 of the 25 companies** must have names that **start with "C"**. These include Coke plus 14 others (e.g. Colgate, Costco, Cadbury, Caterpillar, Comcast, Chevron, Chrysler, Citigroup, Cisco, Campbell's, Conagra, Cardinal Health, Cigna, CVS, etc.). Each gets 1,000 rows with its own **official names, variants, misspellings, and typos**. The other **10 companies** do not start with C (e.g. PepsiCo, Unilever, Amazon, Microsoft). The LLM will see many C-starting and often typo-heavy company names and must correctly identify only the ones matching the user's selected company.
  - **Misspellings and typos**: For every company, the generation script must include **intentional misspellings and typos** in the company name variants (e.g. dropped letters, transposed letters, common phonetic errors). This makes the unique company list larger and noisier and better demonstrates the LLM's ability to match despite errors.
- **Reusable demo**: The same file and app support running the demo for **any of the 25 companies**. User uploads once, then can select Coke, PepsiCo, etc., click **AI Search**, and see the matching contacts in the AI Results tab. The agent identifies that company's name variants and returns the matching contacts each time.
- **User flow**: Upload file → **Contacts** tab shows 25k contacts → user searches/selects a company → user clicks **AI Search** → **second tab** shows matching contacts (e.g. 1,000 for Coke).
- **Agent behavior**: Frontend sends unique company names and a query derived from the selected company. LLM returns which names match. Frontend filters locally and displays all matching contacts in the **AI Results** (or Results) tab.

## Frontend: Upload button, drop zone, and table (detailed plan)

Use this as the spec for the upload and file-display UI.

### 1. Upload file button → opens drop zone

- **Primary control**: An **"Upload file"** (or "Upload contacts") button in the UI. The drop zone is **not** visible by default.
- **On click**: Opening the button reveals or opens the **drop zone** (e.g. in a modal/dialog, or an expandable panel below the button). The drop zone is the area where the user can drag and drop a file or click to choose a file.
- **Drop zone behavior**: Accept only `.csv` and `.xlsx`. Use `react-dropzone` with `accept: { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }`. On drop or file select: read the file, parse it (see Parsing below), then **close the drop zone** (or modal) and show the file contents in the table tab.

### 2. Two tabs: Contacts and AI Results

- **Tab 1 — Contacts**: After a file is loaded, show the full file contents in the **first tab** (e.g. "Contacts"). Display the parsed rows as a **table** (or list): one row per contact, columns = first row headers (Name, Email, Company, etc.). No pagination (see next section). Virtualized list for 25k rows.
- **Tab 2 — AI Results** (or "Results"): This tab shows the **output of the AI Search** — i.e. the contacts that match the company names returned by the LLM. When the user has not yet run AI Search, show an empty state or message (e.g. "Select a company and click AI Search to see matching contacts here"). After AI Search completes, display **all matching contacts** in the same table format (virtualized if needed). An **"Export results"** button downloads the results (including the Description column) as a CSV file (production-grade: filename sanitization, UTF-8 BOM, formula-injection mitigation). The **results table has an extra column: Description** — populated from a client-side mapping (company name → description text), not from the import file. Optionally show count and/or the LLM explanation in this tab. **All companies** (i.e. all matching company name variants) are represented in this tab's output.

### 2b. Search input + company name select list + AI Search button

- **Input box**: Provide an **input box** (search field) that the user can type in to **search for company names**. Use it to filter the options in the select list (see below) as the user types (e.g. substring or case-insensitive match).
- **Select list (dropdown)**: A **select list** (e.g. MUI `Select` or `Autocomplete`) that is **dynamically populated** with **all unique company names** from the uploaded file. Derive the list from the parsed data (e.g. `[...new Set(contacts.map(c => c[companyColumnKey]))].sort()`). When the user has not typed anything, show all unique company names; when the user types in the input, **filter** the options to those that match the search (e.g. "Coca" → show "Coca-Cola Company", "Coca Cola Ltd", etc.).
- **User selects one**: The user **selects one company name** from the list (e.g. click an option or choose from the dropdown). The selected value is used as the target for AI Search.
- **AI Search button**: When a company is selected, show an **"AI Search"** button (e.g. next to the company select or in the toolbar). When the user clicks it: (1) send `uniqueCompanyNames` and a synthetic user message (e.g. "Find everyone that works at [selected company]") to the backend; (2) show loading state (e.g. LMA spinner); (3) on response, filter the local contact list by `matchingCompanyNames` and display the result in the **second tab (AI Results)**. Disable the button when no company is selected or when a request is in flight.
- **When data changes**: When a new file is loaded, repopulate the select list from the new file’s unique company names and clear or reset the current selection and AI Results if needed.

### 2c. Hover over company name: display entity

- **Tooltip on hover**: When the user **hovers over a company name** (in the Contacts table, the AI Results table, or optionally in the company select list), show a **tooltip** (e.g. MUI `Tooltip`) with:
  - **Title line**: The exact company name from the cell followed by `" company name."` — e.g. **"Coca-Cola Europacific company name."**
  - **Body**: The **Entity** (canonical/parent company, e.g. "Coca-Cola") — e.g. "Entity: Coca-Cola".
- **Data source**: **Entity** column in the import file — canonical company or label per row. No Description column; tooltip uses Entity only.
- **Where to show**: Apply the tooltip to the **Company** cell in both the Contacts tab and the AI Results tab (and optionally to options in the company search/select dropdown). If the data has no entity for a given name, show no tooltip or a minimal fallback.

### 3. Performant list for 25,000 contacts (no pagination)

- **Do not paginate**: Show all 25,000 rows in one scrollable view. Do **not** split into pages (e.g. "Page 1 of 500").
- **Virtualization**: Use a **virtualized list** (windowing) so only visible rows (plus a small overscan) are rendered. Options:
  - **@tanstack/react-virtual** (recommended): Wrap the table body in a virtualizer; each row has a fixed or dynamic height; only visible rows are in the DOM. Headers stay fixed; body scrolls.
  - **react-window**: Similar idea; `VariableSizeList` or `FixedSizeList` for the table body.
- **Table structure**: Keep a normal table for headers (`<thead>`) and use the virtualizer for the body (`<tbody>`): render only the visible slice of rows (e.g. rows 0–30 out of 25,000), so the list stays performant while the user scrolls through the full file.

### 4. Parsing (unchanged)

- **CSV**: `Papa.parse(file, { header: true, skipEmptyLines: true })` → array of objects.
- **Excel**: `XLSX.read(file, { type: 'array' })` → first sheet → `XLSX.utils.sheet_to_json(sheet, { defval: '' })` → same shape.
- **Column detection**: Detect company column (e.g. "Company", "Organization"); use detected key for later AI Search/filter. If no company column, show an error and optionally still show the table with a warning.

### Summary

| Item | Spec |
|------|------|
| Entry point | "Upload file" button |
| Drop zone | Shown when user opens upload (modal or panel); accept CSV/Excel only |
| After drop | Parse file, close drop zone, show contents in **Contacts** tab |
| **Tabs** | **Tab 1 — Contacts**: full file contents (virtualized table). **Tab 2 — AI Results**: output of AI Search (all matching contacts). No chat. |
| Table | Both tabs use same table format; virtualized body for large row counts |
| Row count | 25,000 in Contacts; AI Results shows only matching rows (e.g. 1,000). **No pagination**; use **virtualized list** (e.g. @tanstack/react-virtual) for performance. |
| **Search + select** | **Input box** to search company names; **select list** dynamically populated with all unique company names; user **selects one** company. |
| **AI Search** | **Button** "AI Search" shown when a company is selected. On click: call backend with selected company as query; show results in **Tab 2 (AI Results)**. Loading spinner during request. No chat UI. |
| **Company hover** | **Hover over company name**: tooltip title is **"[Company name] company name."**; body is **Entity** (e.g. "Entity: Coca-Cola"). Entity column only; no Description in import. |

---

## Implementation steps

### 1. Scaffold React app

- Create project with `npm create vite@latest` (React + TypeScript or JavaScript).
- Install: `papaparse`, `xlsx`, `react-dropzone`, **MUI** (`@mui/material`, `@emotion/react`, `@emotion/styled`), and **testing**: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`; **Storybook** (`@storybook/react-vite`, `@storybook/addon-essentials`); **Playwright** (`@playwright/test`). Add npm scripts: `test`, `storybook`, `test:e2e` (see Step 9).

### 2. File drop zone

- One visible drop zone (e.g. dashed border, "Drop CSV or Excel here"). Use `react-dropzone` with `accept` for `.csv` and `.xlsx`. On `onDropAccepted`: take the first file, pass to parser.

### 3. Parsing layer

- **CSV**: `Papa.parse(file, { header: true, skipEmptyLines: true })` → `data` array of objects.
- **Excel**: `XLSX.read(file, { type: 'array' })` → first sheet → `XLSX.utils.sheet_to_json(sheet, { defval: '' })` → same structure.
- Normalize so both paths produce `Array<Record<string, string>>`. **Column detection**: Identify the company column (e.g. header named "Company", "Organization", or configurable); if missing, show a clear error and do not allow AI Search until resolved.

### 4. State and table UI

- State: e.g. `contacts`, `error`, `fileName`. If `contacts`: render a table with virtualization or pagination for 25k rows. Do not send `contacts` to the backend — only derive and send unique company names when the user clicks AI Search. Optional: empty state when no file yet; "Clear" or "Upload another" to reset.

### 5. Sample contact file (for demo) — new file replaces old

- **Scale**: **25,000 contacts** total across **25 companies** (1,000 contacts per company). One company is **Coke** (1,000 rows); the other **24 companies** each have 1,000 rows with the same naming convention (varied official names + **misspellings + typos** per company).
- **Columns**: Name, Email, Company (and optionally Phone, Region).
- **Per-company convention**: For each of the 25 companies, define a curated list of **official and variant names** plus **misspellings and typos** (e.g. "Coca Cola Compnay", "Colgate-Palmoliv", "Costco Wholsale"). Generation script assigns 1,000 rows per company by sampling from that company's name list.
- **List of 25 companies**: The script uses a defined list of 25 parent companies. **15 of the 25** must **start with "C"** (Coke + 14 others, e.g. Colgate, Costco, Cadbury, Caterpillar, Comcast, Chevron, Chrysler, Citigroup, Cisco, Campbell's, Conagra, Cardinal Health, Cigna, CVS). The other **10** do not start with C (e.g. PepsiCo, Unilever, Amazon, Microsoft, Apple, Walmart, etc.). **Create a new demo file** that replaces the previous one; output path e.g. `client/public/demo-contacts-25k.csv`.
- **15 "C" companies**: So that searching for **Coke** (or any C company) is non-trivial, **15 of the 25 companies** have names starting with "C". Each has 1,000 rows with its own variants, **misspellings, and typos**. The LLM will see many C-starting and often typo-heavy company names and must return only the ones matching the user's selected company.
- **Misspellings and typos**: Every company's variant list must include **intentional typos and misspellings** (dropped letters, transposed letters, phonetic errors). This increases the size and noise of the unique company list and better demonstrates the LLM's matching ability.
- **Entity for hover**: To support **hover tooltip** (see §2c), include an **"Entity"** column (canonical company per row). Tooltip title is "[Company name] company name."; body is "Entity: [entity]". No Description column in the import.
- **Output**: Single CSV (and optionally .xlsx). Same file is used to run the demo for **any of the 25 companies**. Regenerating produces the **new** file (15 C companies, typos throughout), replacing the old demo file.

### 6. Backend (Node + Express)

- Route: `POST /api/chat` — body `{ messages, uniqueCompanyNames: string[] }`. Do not accept or store contact rows (PII).
- **Validation**: Reject invalid payloads (non-array, missing fields) with 400. Use a schema (e.g. Zod, Joi). Optionally cap total length (e.g. 10,000–20,000) to bound cost; otherwise rely on **batching**.
- **Batching**: If there are many unique company names, split into batches (e.g. 300–500 per batch). For each batch: build prompt with that chunk and the user message; call the LLM with **structured output** and a **timeout** (e.g. 30–60s per call). Merge and deduplicate results, then sanitize (only names from the request). Process batches sequentially (or limited concurrency). Return a single response.
- **Prompt and LLM**: Use structured output (e.g. OpenAI JSON mode). Set a timeout on each LLM call.
- **Response sanitization**: After parsing the LLM response, **filter** `matchingCompanyNames` so it only includes names that appear in the request's `uniqueCompanyNames`. Return `{ matchingCompanyNames: string[], explanation?: string }`; on parse failure, return 502 or 503 with a generic message.
- **Error handling**: Map LLM 429/5xx and timeouts to appropriate HTTP status and safe error messages. Never log or expose PII.
- Env: `OPENAI_API_KEY` via `dotenv`. CORS restricted to frontend origin (env var in production). Document in `.env.example`.

### 7. AI Search button and Results tab (React) — no chat

- **AI Search button**: Shown next to (or near) the company search/select when a company is selected. On click: compute `uniqueCompanyNames` from the current `contacts`; build a single user message (e.g. "Find everyone that works at [selected company]"); send `{ messages: [{ role: 'user', content: thatMessage }], uniqueCompanyNames }` to the backend. Never send the contact list. If no file is loaded or no company column or no company selected, disable the button.
- **Loading and errors**: Disable the AI Search button and show loading state (e.g. **LMA-themed loading spinner**) while the request is in flight. On network error, timeout, or 4xx/5xx, show a user-friendly error and allow retry.
- **Results tab**: When response returns `matchingCompanyNames`, **normalize** when filtering (e.g. trim company names before compare). Filter the **local** `contacts` where Company (normalized) is in `matchingCompanyNames`. Display **all matching contacts in the second tab (AI Results)**. Optionally show count and/or explanation in that tab. **No chat window** — only the button and the Results tab.

### 8. UI and theming (MUI, dark/light, accent)

- **MUI**: Use Material-UI for layout, components (AppBar, Paper, TextField, Button, Table, etc.). Wrap the app in `ThemeProvider` and optionally `CssBaseline`.
- **Bright green accent**: Set the primary palette color to a **bright green** (e.g. `#00e676`, `#00c853`). Use for primary buttons, links, selected state, and key accents.
- **Dark and light mode**: Implement a **theme mode toggle** (e.g. in the app bar). Use MUI's `createTheme` with `palette.mode: 'light' | 'dark'`; store the user's choice in `localStorage` and restore on load.
- **LMA-themed loading spinner**: Loading spinner themed after **LMA** (Legal Marketing Association). Use LMA brand palette: Primary blue `#3F47AA`, White `#FFFFFF`, optional lavender `#C2BADF`. Use during: (1) file upload/parsing, (2) AI Search/LLM request in flight.

### 9. Test suite (Vitest, Storybook, Playwright)

- **Vitest**: Client tests in `client/__tests__/` (parseFile, filter logic, components). Server tests in `server/__tests__/` (validation, sanitization, batching, errors). Mock `fetch` for AI Search; mock LLM for backend.
- **Storybook**: `.storybook/main.ts`, `.storybook/preview.tsx` with MUI ThemeProvider and light/dark. One story per component: DropZone, ContactsTable, AI Search button / Results tab, LMASpinner.
- **Playwright**: `playwright.config.ts` in client root. E2E: (1) Upload CSV, assert table in Contacts tab; (2) Select a company (e.g. Coke), click AI Search, assert results in second tab (AI Results). Scripts: `test:e2e`, `test:e2e:ui`.

## File structure (suggested)

Single repo (monorepo): root contains `client/` and `server/`.

- **client/** — Vite React app: `src/` (App, theme, components, utils), `__tests__/`, `.storybook/`, `e2e/`, `playwright.config.ts`, `public/` or `data/` for sample CSV, `scripts/generate-contacts.js`, `package.json`.
- **server/** — Express app: `index.js`, `__tests__/`, `.env.example`, `package.json`.

## Production and robustness

- **Security**: Input validation (request body schema); response sanitization (only return company names that were in the request); no PII in logs; CORS restricted; API key only in server env; optional rate limiting.
- **Batch processing**: When `uniqueCompanyNames` is large, batch (e.g. 300–500 per batch), call LLM per batch, merge and sanitize, return one response. Process sequentially or with limited concurrency.
- **Reliability**: LLM timeout (e.g. 30–60s); structured output (JSON mode); error handling for 429, 5xx, timeouts; frontend loading and retry.
- **API contract**: Request `{ messages, uniqueCompanyNames }`; Response `{ matchingCompanyNames, explanation? }`; errors `{ error, code? }`. **Large lists**: Backend uses batch processing; optional high cap (e.g. 10k–20k names) to bound cost; no 400 solely for large lists.
- **Data and parsing**: Use the **detected column key** (not hardcoded "Company") when deriving `uniqueCompanyNames` and when filtering. Normalize when filtering (e.g. trim). Handle empty/invalid file.
- **Testing**: Full suite — Vitest (unit/integration), Storybook (component docs), Playwright (E2E). See File structure and Step 9.

## Out of scope

- Google Sheets API (only file upload from exports). Editing or deleting contact rows (display only). Streaming LLM responses. Sending any PII to the backend or LLM. User authentication (single-user or demo deployment).

## Delivered UX (demo)

1. Professional MUI UI with bright green accent and dark/light mode toggle.
2. User opens app → sees upload and (after file load) Contacts tab + company search + AI Search button.
3. User drags and drops the contact file → Contacts tab loads (25k rows, 25 companies). PII stays in the browser.
4. User searches/selects a company (e.g. Coke), clicks **AI Search** → frontend sends only unique company names and query → LLM returns which names match → frontend filters locally and displays the matching contacts in **Tab 2 (AI Results)**. Same demo can be run for all 25 companies.

---

## Implementation status (living document)

Update this section as you build so the next person or LLM knows what is done and what is next.

- **Done**: Plan fixed (typo "large lists" → period). Repo scaffold; client (Vite React, MUI, upload, drop zone, virtualized table, company select); server (`POST /api/chat`, validation, batching, OpenAI, sanitization). **Plan updates implemented**: (1) **Chat removed** — no chat tab or ChatWindow; (2) **AI Search** button when company selected; (3) **Tab 2 = AI Results** — shows matching contacts from last AI Search (empty state until first search); (4) **Contact generator** — 15 companies starting with C, 10 non-C, typos/misspellings, **Entity** column (no Description); output `client/public/demo-contacts-25k.csv`; (5) **Company name hover** — tooltip title "[Company name] company name.", body "Entity: [entity]"; applied in Contacts and AI Results tables; (6) **parseFile** — `detectEntityColumnKey`, `entityColumnKey` returned from `parseContactFile`. **Description removed from import**; **Description column on results** — AI Results table (and any results export) includes an extra **Description** column, filled from a client-side mapping (`companyDescriptions.ts`) keyed by company name. (7) **Export results** — "Export results" button on AI Results tab downloads CSV (including Description) with filename sanitization, UTF-8 BOM, formula-injection mitigation, and error Alert on failure (`exportCsv.ts`). (8) **Styling polish** — theme `shape.borderRadius: 8`; AppBar border and toolbar padding; top bar in Paper with background; Tabs minHeight and primary indicator; AI Results header row (count + Export button), info cards with borderRadius, spacing before table; ContactsTable Paper borderRadius and header/cell padding; empty state padding.
- **Done (agentic)**: (9) **Visible reasoning** — backend returns `reasoningSteps`; frontend shows "How the agent matched" section. (10) **Web search tool** — backend mock `search_web` + agent loop on first batch; returns `toolCalls`; frontend shows "Agent looked up". (11) **Follow-up refinement** — backend accepts `previousMatchingNames` and multi-message; frontend Refine input + button; validation (max messages, message length, previousMatchingNames subset). See [PLAN-AGENTIC.md](PLAN-AGENTIC.md).
- **Next**: Optional: Storybook stories for AI Search flow; E2E test for select company → AI Search → Export results → assert download. Update tests that referenced ChatWindow.
