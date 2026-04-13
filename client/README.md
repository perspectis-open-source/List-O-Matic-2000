# List-O-Matic 2000 — Client

React + Vite + MUI frontend for List-O-Matic 2000. Import contacts and optionally companies (CSV/Excel), search and select a company, run AI Search, and view matching contacts in the AI Results tab.

For full setup (client + server, env vars, quick start), see the [root README](../README.md).

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server (default http://localhost:5173) |
| `npm run build` | Production build |
| `npm run test` | Vitest (watch) |
| `npm run test:run` | Vitest single run |
| `npm run test:coverage` | Vitest with coverage |
| `npm run storybook` | Storybook (port 6006) |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run generate-contacts` | Generate `public/demo-contacts-25k.csv` (company variants) and `public/demo-companies-500.csv` (25 canonical + 475 S&P names, requires `scripts/data/sp500-constituents.csv`) |
