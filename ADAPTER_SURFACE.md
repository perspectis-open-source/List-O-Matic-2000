# Adapter Surface Budget

Canonical app root: `syncsphere_platform/vendor/list-o-matic-2000`

## Policy

- App core cannot import `@vendor-shared/*` or `@syncsphere/vendor-governance*` directly.
- External integration is allowed only inside provider/runtime boundary modules.
- New surface area requires explicit architecture approval.

## Current Surface

| Symbol / Capability | Why needed | Used by | Replacement difficulty |
| --- | --- | --- | --- |
| `withLlmEvidence(stepName, createParams, exec)` | Wrap LLM calls for integrated evidence or standalone ops logs | `server/index.js` | Medium |
| `expressCorrelationMiddleware()` | Correlation ID propagation for request-scoped logs | `server/index.js` | Low |
| `getCorrelationIdFromStore()` | Correlate stream progress and operational logs | `server/index.js` | Low |
| `registerOperationalRoutes(app)` | Mode-gated route registration (`/api/matcher-evidence`) | `server/index.js` | Low |
| `openaiListPricing` helpers | Stable token/cost presentation in matcher UI | `client/src/constants/openaiPricing.ts`, `client/src/matcher/matcherStreamPreset.ts` | Low |
| `VendorActivityLogLine` + palette types | Operational log rendering and highlighting | `client/src/matcher/*` | Low |
| `coerceTrimmed`, `isNonEmptyCoercedTrimmed` | Input normalization | `client/src/App.tsx` | Low |
| `buildEvidenceGetUrl` | Correlation query URL generation | `client/src/App.tsx` | Low |

## Budget Targets

- Utils: <= 6 symbols
- UI primitives: <= 4 symbols
- Runtime integration symbols: <= 5 symbols
- Type-only symbols: <= 6 symbols
