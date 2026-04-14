# List-O-Matic 2000

**Open source** — Upload a contact list (CSV/Excel), then use AI to find everyone at a company. The LLM receives only **company names** (no PII); the frontend filters the contact list locally and displays results.

- [Quick start](#quick-start) · [Managed Cloud](#managed-cloud-1399month) · [Tests](#run-tests) · [Contributing](./CONTRIBUTING.md) · [Code of Conduct](./CODE_OF_CONDUCT.md) · [License](./LICENSE)

See **[PLAN.md](./PLAN.md)** for the full build plan and spec. See **[ROADMAP.md](./ROADMAP.md)** for what we're doing next (phases, releases, community).

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
- **E2E (Playwright)**: `cd client && npm run test:e2e`. E2E mocks `POST /api/chat` via `page.route()` so the backend is not required. Tests cover: upload + AI search flow, Export list on Contacts tab, Remove records from Import List and persisted AI results when switching back, and LLM search dialog warning. Tests and fixtures in `client/e2e/`. Set `PLAYWRIGHT_BASE_URL` when running against a deployed app.
- **Server**: `cd server && npm run test` (if present).

## Managed Cloud ($13.99/month)

This repository stays fully open source under MIT for free self-hosting.  
`List-O-Matic Cloud` is a separate managed hosted offer at **$13.99/month**.

- **Free self-hosted (this repo)**: run client + server yourself.
- **Managed Cloud**: hosted convenience with account/billing management.
- **Enterprise**: not in current launch scope; optional future path.

### Day-one subscription architecture

Cloud is developed from a shared-core architecture, but **cloud billing internals are not shipped in this OSS repo**.

- Public OSS keeps core app logic and stable interfaces/contracts.
- Private cloud runtime implements billing/accounts/subscription internals.
- Boundary enforcement and OSS export checks run in CI.

Boundary tooling:

- `npm run verify:boundaries`
- `npm run verify:oss-export`
- See [`BOUNDARIES.md`](./BOUNDARIES.md) for policy details.

Mirror automation:

- `.github/workflows/oss-mirror-sync.yml` generates `.oss-export` on `main`/`master`.
- If `OSS_MIRROR_REPO` and `OSS_MIRROR_TOKEN` secrets are set, it pushes the export to your public mirror automatically.

## Repo layout

- **client/** — React (Vite), MUI, drag-and-drop upload, table, company select, AI Search button, AI Results tab. Parsing and filtering in the browser; only unique company names sent to the API.
- **server/** — Express; `POST /api/chat` accepts `{ messages, uniqueCompanyNames }`, calls LLM, returns `{ matchingCompanyNames, explanation? }`.
- **PLAN.md** — Full build plan (sections 1–18). Single source of truth for rebuilding the app from scratch.

## Demo contact file

Running **`cd client && npm run generate-contacts`** writes:

- **`client/public/demo-contacts-25k.csv`** — 25,000 rows; columns `First`, `Last`, `Company`, `Title`, `Email`, `City`, `State`, `Zip`, `Country`. Same 25×1,000 structure (15 “C” names, etc.).
- **`client/public/demo-companies-500.csv`** — 500 rows; columns `Name`, `Client Number`, `Open Date`, `Status`, `Client Originating Attorney`. The first **25** rows are **canonical** client names (one per contact group). Contacts use **only spelling/brand variants** of those clients in `Company`, not the canonical string. Rows **26–500** are **real S&P 500 company names** from [`client/scripts/data/sp500-constituents.csv`](client/scripts/data/sp500-constituents.csv) (Open Database License), chosen so the `Name` does not exactly match any contact `Company` string or canonical name.

Upload via **Import contacts** / **Import companies** on the start screen.

## Env (server)

| Variable         | Description                          |
|------------------|--------------------------------------|
| `OPENAI_API_KEY` | OpenAI API key (or equivalent)       |
| `CORS_ORIGIN`    | Frontend origin (e.g. http://localhost:5173) |
| `PORT`           | Server port (e.g. 3001)              |

## License

This project is open source under the [MIT License](./LICENSE).

Managed cloud policy docs:
- [Cloud Terms](./CLOUD_TERMS.md)
- [Privacy Policy](./PRIVACY.md)
- [Trademark Policy](./TRADEMARK.md)
