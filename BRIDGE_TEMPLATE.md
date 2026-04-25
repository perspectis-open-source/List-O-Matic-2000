# Bridge Template

Use this template for future vendor app extraction work.

## Standard Layout

- `client/src/platform/mode.ts`
- `client/src/platform/local/shared/*`
- `server/platform/runtime.js`
- `server/platform/operationalLogger.js`

## Required Capabilities

- Mode read + validation (`integrated|standalone`)
- Correlation middleware
- LLM wrapper (`withLlmEvidence`)
- Mode-gated route registration
- Local standalone logging sink

## Capability Matrix

| Capability | integrated | standalone |
| --- | --- | --- |
| Governance evidence endpoint | enabled | disabled |
| Governance JSONL writes | enabled | disabled |
| Activity panel detail | governance evidence | operational logs |
| Export route | governance-compatible if available | basic JSON export |
| Operational logs | yes | yes |

## CI Guardrails

- Reject forbidden imports in app core:
  - `@vendor-shared/*`
  - `@syncsphere/vendor-governance*`
- Run both mode test lanes.
- Mirror sync validation must pass with zero diff or approved diff.
