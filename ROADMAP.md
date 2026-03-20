# List-O-Matic 2000 — Roadmap

The project runs as:
- **Open source MIT core** (free self-hosted)
- **Managed Cloud** (single paid utility plan at **$13.99/month**)

Enterprise packaging is intentionally out of launch scope and may be evaluated later.

## Current status

- Product flow is live: upload contacts -> select company -> AI Search -> export results.
- Core privacy posture remains: only company names go to the API; PII stays in browser processing.
- OSS/cloud boundary policy is active: this public repo stays OSS-safe, while billing/account internals are implemented in private cloud runtime.

## Track A — OSS roadmap

- Keep onboarding smooth: docs, setup, tests, and contribution hygiene.
- Keep CI stable and tests current for import/search/export flows.
- Keep self-hosting first-class and clearly documented.

Done when:
- New contributors can clone, run, and test without friction.
- Docs always match current behavior and environment requirements.

## Track B — Cloud roadmap (launch scope)

### Phase 1: foundation

- Keep one cloud plan: `$13.99/month`.
- Keep billing architecture extensible:
  - `plans` catalog (start with one active plan)
  - `subscriptions` linked by `planId`
  - `entitlements` checks (features + limits)
  - centralized billing service for checkout/cancel lifecycle
- Publish cloud docs/legal baseline: cloud terms, privacy, trademark.

### Phase 2: launch

- Add account/workspace lifecycle for managed cloud users.
- Connect billing flow end-to-end (provider integration, webhook sync, cancel path).
- Launch cloud publicly and monitor activation + month-1 retention.

Done when:
- A user can sign up, subscribe, use the utility, and cancel without manual operator work.
- A second subscription plan can be added mostly through plan configuration and entitlement rules (not rewrites).

## Future optional track

- Enterprise capabilities (for example SSO/procurement needs) are optional future work only if customer demand justifies it.

## Working cadence

- Prioritize OSS reliability and cloud launch tasks in parallel.
- Keep this file updated whenever scope changes.

For implementation detail and build spec, see [PLAN.md](./PLAN.md).
