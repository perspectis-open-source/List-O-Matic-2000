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
| `npm run generate-contacts` | Generate **`public/demo-contacts-5k.csv`** + **`public/demo-companies-500.csv`** — sparse scenario: 75 list-matchable variants (25×3) + 4,925 off-list (one `Company` string per seed (567 unique `Company` strings: 75 matchable + 492 off-list)); does **not** overwrite the legacy pair |
| `npm run generate-contacts:legacy` | Generate **`public/demo-contacts-25k-legacy.csv`** + **`public/demo-companies-500-legacy.csv`** — original dense scenario: 25×1,000 contacts (all matchable variants), same column schemas |
| `npm run build-off-list-seed` | Rebuild `scripts/data/off-list-seed-companies.csv` from `sp500-constituents.csv`, FTSE sample, `russell-2000-components.csv`, and `nasdaq-listed.csv` |

## Demo generator inputs (`scripts/data/`)

`npm run generate-contacts` expects these files (commit them so clones work offline):

| File | Role |
|------|------|
| `scripts/data/sp500-constituents.csv` | S&P 500 constituents (`Security` column); fillers on the 500-row companies file |
| `scripts/data/off-list-seed-companies.csv` | Built by `npm run build-off-list-seed` |
| `scripts/data/ftse100-historical-sample.csv` | Input to `build-off-list-seed` |
| `scripts/data/russell-2000-components.csv` | Russell 2000 `Ticker`/`Name` table (off-list seeds; merged before NASDAQ) |
| `scripts/data/nasdaq-listed.csv` | Input to `build-off-list-seed` |

If `ENOENT` on `sp500-constituents.csv`, repopulate `scripts/data/` and rebuild the seed, then regenerate:

```bash
mkdir -p scripts/data
curl -sL -o scripts/data/sp500-constituents.csv \
  'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv'
curl -sL -o scripts/data/ftse100-historical-sample.csv \
  'https://raw.githubusercontent.com/jessicayung/machine-learning-nd/master/p5-capstone/ftse100-list.csv'
curl -sL -o scripts/data/nasdaq-listed.csv \
  'https://datahub.io/core/nasdaq-listings/r/nasdaq-listed.csv'
curl -sL -o scripts/data/russell-2000-components.csv \
  'https://raw.githubusercontent.com/ikoniaris/Russell2000/master/russell_2000_components.csv'
npm run build-off-list-seed
npm run generate-contacts
```
