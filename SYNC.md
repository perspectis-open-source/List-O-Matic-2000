# Sync Playbook

Canonical source: `syncsphere_platform/vendor/list-o-matic-2000` in main SyncSphere repo.

## Normal Flow

1. Implement and test in canonical source.
2. Validate both modes:
   - `PLATFORM_MODE=integrated`
   - `PLATFORM_MODE=standalone`
3. Mirror changes to standalone repo.
4. Verify mirror diff is zero (or approved with reason).

## Mirror Failure / Rollback

- If mirror conflicts:
  - Stop release sync.
  - Open triage issue with owning engineer.
  - Rebase/replay canonical commits in standalone mirror branch.
- If mirror is broken after sync:
  - Roll back to last known-good mirror tag/commit.
  - Re-run validation checklist.
  - Re-attempt mirror sync with explicit reviewer approval.

## Approved Diff Policy

- Allowed only with explicit owner approval.
- Record:
  - why diff exists,
  - expected follow-up commit,
  - target date for convergence.
