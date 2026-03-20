# OSS / Cloud Boundary Policy

This repository is the public OSS surface. Managed cloud internals are intentionally excluded.

## Allowed in OSS

- `client/**`
- `server/index.js`
- `server/.env.example`
- `server/package.json`
- `README.md`, `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `ROADMAP.md`
- `.github/**` workflows and templates that do not expose private infrastructure details

## Not allowed in OSS

- Billing provider integrations (for example Stripe SDK usage)
- Cloud account/workspace persistence models
- Subscription lifecycle internals (checkout sessions, webhook handlers)
- Private service credentials or cloud-secret environment variables

## Dependency rules

- OSS code must not import cloud-only modules.
- OSS code must not reference cloud-only env keys (`STRIPE_*`, `CLOUD_*`, `BILLING_*`, `WEBHOOK_SECRET`).
- OSS docs can mention managed cloud at a product level, but must not include private ops internals.

## Enforcement

These checks are enforced by automation:

- `node scripts/verify-boundaries.mjs`
- `node scripts/verify-oss-export.mjs`
- `.github/workflows/oss-mirror-sync.yml` for artifact generation and optional mirror sync

Any failed boundary check blocks merge and release.

## Mirror sync setup

Configure these repository secrets to enable automatic public mirror updates:

- `OSS_MIRROR_REPO` — target mirror in `owner/repo` format
- `OSS_MIRROR_TOKEN` — token with `contents:write` access to the mirror repository

If secrets are not configured, the workflow still builds and publishes the OSS export artifact but skips mirror push.
