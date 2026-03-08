# List-O-Matic 2000 — Roadmap

**New plan** (as of 2025). The app is built and open source; this document is the single place for **what we do next**.

---

## Current status

- **Product**: Contact list upload (CSV/Excel) → company search → AI Search → results in second tab. PII stays in the browser; only company names go to the LLM.
- **Repo**: Public at `perspectis-open-source/List-O-Matic-2000`. LICENSE (MIT), CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, and GitHub templates in place.
- **Implementation**: Core flow done (upload, parse, company select, AI Search, AI Results, export, tooltips, theming). Agentic features (reasoning steps, web search, follow-up refinement) per PLAN-AGENTIC.md.

---

## Phase 1 — Ship & stabilize (priority)

| Goal | Actions |
|------|--------|
| **CI green** | Fix any failing tests; ensure `main` stays green on push/PR. |
| **Tests up to date** | Remove or update tests that referenced removed pieces (e.g. ChatWindow). Add E2E for: select company → AI Search → Export → assert download. |
| **Docs match product** | README quick start and env table accurate. CONTRIBUTING clone URL uses real org/repo (e.g. `perspectis-open-source/List-O-Matic-2000`). |
| **First release** | Tag `v1.0.0` (or `v0.1.0`) when Phase 1 is done. Add a short CHANGELOG or release notes. |

**Done when**: Default branch is protected with passing CI; new contributors can clone, install, and run tests; one version tag exists.

---

## Phase 2 — Community & maintainability

| Goal | Actions |
|------|--------|
| **Contributing friction low** | Clear “good first issue” or “help wanted” labels; small, scoped issues where possible. |
| **Storybook current** | Stories for main flows (UploadDropZone, ContactsTable, CompanySelect, AI Search / Results). Run in CI (e.g. build or static export) if useful. |
| **Dependencies & security** | `npm audit` (and fix or document); Dependabot or similar if desired. |
| **Deploy story** | Document or script for “run in production” (e.g. build client, run server, env vars). Optional: one-click deploy (e.g. Render, Fly, Vercel + serverless). |

**Done when**: A new contributor can find something to work on and open a PR with confidence; the app can be deployed from the repo.

---

## Phase 3 — Optional enhancements

Defer until Phases 1–2 are solid. Pick by value vs effort.

- **UX**: Keyboard shortcuts; accessibility pass (focus, labels, screen reader); mobile-friendly layout.
- **Features**: Optional Google Sheets import (per PLAN out-of-scope note); configurable company/entity column names; “Remove from import list” / persisted AI results (if not already done).
- **Backend**: Rate limiting; health check endpoint; optional multi-provider LLM (e.g. OpenAI + Anthropic).
- **Observability**: Optional logging/metrics for API usage (no PII); error tracking (e.g. Sentry) with PII stripped.

---

## How to use this plan

- **Sprints / cycles**: Take 1–2 items from Phase 1 until it’s complete, then Phase 2.
- **Issues**: Create GitHub issues from this roadmap and link them here (e.g. “Phase 1: E2E for export”).
- **Updates**: Edit ROADMAP.md when priorities change; keep “Current status” and “Done when” criteria accurate.

For **how the app was built** (spec, constraints, file layout), see [PLAN.md](./PLAN.md). For agentic behavior, see [PLAN-AGENTIC.md](./PLAN-AGENTIC.md).
