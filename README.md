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

Running **`cd client && npm run generate-contacts`** writes the **sparse** demo pair (does not touch the legacy pair):

- **`client/public/demo-contacts-5k.csv`** — 5,000 rows; columns `First`, `Last`, `Company`, `Title`, `Email`, `City`, `State`, `Zip`, `Country`. **75** rows use **only** spelling/brand variants of the **25** canonical clients (3 per client), never the exact canonical `Name` on the row. The other **4,925** rows share off-list labels from [`client/scripts/data/off-list-seed-companies.csv`](client/scripts/data/off-list-seed-companies.csv) (see `npm run build-off-list-seed` in the client): **one** `Company` string per seed so unique `Company` values stay around **75 + 492 = 567** (not one new name per row) and matcher HTTP batches stay roughly **ceil(unique/30)** (about **19** at batch size 30).
- **`client/public/demo-companies-500.csv`** — 500 rows; columns `Name`, `Client Number`, `Open Date`, `Status`, `Client Originating Attorney`. First **25** canonical clients; rows **26–500** are S&P fillers from [`client/scripts/data/sp500-constituents.csv`](client/scripts/data/sp500-constituents.csv) (Open Database License), not appearing as contact `Company`.

**Legacy dense demo** (original 25×1,000 all-matchable scenario): **`npm run generate-contacts:legacy`** in `client/` writes **`demo-contacts-25k-legacy.csv`** and **`demo-companies-500-legacy.csv`** (same column layouts as above).

Upload via **Import contacts** / **Import companies** on the start screen.

## Env (server)

| Variable         | Description                          |
|------------------|--------------------------------------|
| `OPENAI_API_KEY` | OpenAI API key (or equivalent)       |
| `CORS_ORIGIN`    | Frontend origin (e.g. http://localhost:5173) |
| `PORT`           | Server port (e.g. 3001)              |
| `MATCH_SNAPSHOT_DIR` | Optional. Directory for **matcher snapshots** (`POST /api/match-companies`). Default: `server/data/matcher-snapshots/`. |
| `MATCH_SNAPSHOT_DISABLE` | If `true` / `1` / `yes`, skip reading and writing snapshots (always call the LLM). |

### Matcher disk snapshots

After a matcher run, the server merges **`results`** into one JSON file per **companies list** (`list-<hash>.json`): contact rows are keyed by import `raw` plus a fingerprint of `topCandidates`, and **`parentByCanon`** is stored for the list. If every row in the request is already in that file, the handler returns immediately (no LLM; **works without `OPENAI_API_KEY`**). If only some rows match, it runs the LLM **only for missing rows** and **appends** them to the same file. See `server/.env.example`. Default directory: `server/data/matcher-snapshots/` (gitignored unless you change that).

## License

This project is open source under the [MIT License](./LICENSE).

Managed cloud policy docs:
- [Cloud Terms](./CLOUD_TERMS.md)
- [Privacy Policy](./PRIVACY.md)
- [Trademark Policy](./TRADEMARK.md)
