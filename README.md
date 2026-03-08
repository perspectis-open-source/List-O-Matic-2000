# Marketing Demo: Contact List + AI Agent

A demo app for marketing: upload a contact list (CSV/Excel), then ask the chatbot to find everyone at a company. The LLM receives only **company names** (no PII); the frontend filters the contact list locally and displays results. See **[PLAN.md](./PLAN.md)** for the full build plan (living document for handoff to another person or LLM).

## Quick start

### Prerequisites

- Node.js 18+
- npm or pnpm

### 1. Client (React + Vite)

```bash
cd client
npm install
npm run dev
```

Runs at http://localhost:5173 (or next available port).

### 2. Server (Node + Express)

```bash
cd server
cp .env.example .env
# Edit .env: set OPENAI_API_KEY, CORS_ORIGIN (e.g. http://localhost:5173), PORT (e.g. 3001)
npm install
npm run dev
```

### 3. Run tests

- **Unit tests (Vitest)**: `cd client && npm run test` (watch) or `npm run test:run` (single run). Coverage: `npm run test:coverage`.
- **Component tests**: Same Vitest run; tests live next to components (`*.test.tsx`) and in `src/utils/*.test.ts`, `src/api/*.test.ts`. Use `src/test/utils.tsx` for theme-wrapped render.
- **Storybook**: `cd client && npm run storybook` (port 6006). Stories in `src/**/*.stories.tsx`; preview uses the app MUI theme.
- **E2E (Playwright)**: `cd client && npm run test:e2e`. E2E mocks `POST /api/chat` via `page.route()` so the backend is not required. Tests and fixtures in `client/e2e/`. Set `PLAYWRIGHT_BASE_URL` when running against a deployed app.
- **Server**: `cd server && npm run test` (if present).

## Repo layout

- **client/** — React (Vite), MUI, drag-and-drop upload, table, chat window. Parsing and filtering in the browser; only unique company names sent to the API.
- **server/** — Express; `POST /api/chat` accepts `{ messages, uniqueCompanyNames }`, calls LLM, returns `{ matchingCompanyNames, explanation? }`. API key in env only.
- **PLAN.md** — Full specification and implementation steps (Steps 1–9). Use as the single source of truth when building or handing off.

## Demo contact file

A 25,000-row demo CSV is generated and saved at **`client/public/demo-contacts-25k.csv`**. To regenerate:

```bash
cd client && npm run generate-contacts
```

Then upload that file in the app (or open the app and use "Upload file" to select it). The file has 25 companies (1,000 contacts each), including Coke and 5–6 other companies whose names start with "C" (Colgate, Costco, Cadbury, etc.) for the Coke-search demo.

## Env (server)

| Variable         | Description                          |
|------------------|--------------------------------------|
| `OPENAI_API_KEY` | OpenAI API key (or equivalent)       |
| `CORS_ORIGIN`    | Frontend origin (e.g. http://localhost:5173) |
| `PORT`           | Server port (e.g. 3001)              |
