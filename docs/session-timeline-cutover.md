# Session timeline cutover

Status: non-visual foundation implemented, 17 September 2026.

## Implemented before the interface handoff

- Expo Crypto-backed monotonic ULIDs, used through `createId()` everywhere.
- A discriminated heat/cold/rest interval domain model.
- Separate working-draft and save-ready validation contracts.
- Totals for active, heat, cold, rest, recorded and untracked time.
- Version-two account-scoped draft storage with readable append, update,
  remove and move operations.
- Additive `session_intervals` tables in SQLite and Supabase.
- Database ownership foreign keys, ordering constraints, temperature rules,
  indexes, RLS policies and minimum privileges.
- Generated Supabase TypeScript types and domain, repository, SQLite and pgTAP
  regression tests.

## Temporary compatibility boundary

The current screens continue using the version-one round draft and sync payload.
This is intentional: the designer owns the new interaction and the application
must remain runnable while that work is in progress. The legacy round model is
not canonical and must receive no new product behavior.

## Cutover after approved designs

1. Change manual logging and timer orchestration to version-two timeline drafts.
2. Add a timeline save command that writes `sessions`, `session_intervals` and
   the outbox atomically.
3. Version the push and pull RPC payloads and switch the sync engine to ordered
   intervals.
4. Move screen reads behind timeline query hooks and view models.
5. Update statistics, detail, share and repeat-session behavior.
6. Remove the version-one draft schema, adapter, round tables, round RPC fields
   and round-oriented tests.
7. Regenerate database types, reset the development databases and execute the
   complete native, SQLite, sync, RLS and UI test matrix.
