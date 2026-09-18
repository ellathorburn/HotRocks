# HotRocks architecture

Status: timeline model implemented, 18 September 2026.

For a Laravel-oriented guide to where types, CRUD functions, and screens live,
see [Code map](./code-map.md).

For screen-level usage examples, loading/error rules, and allowed imports, see
[Frontend data access](./frontend-data-access.md).

## Decisions

- Every user creates a permanent HotRocks account. Apple and Google are the
  primary sign-in methods; email OTP is the fallback.
- Strava is an optional integration, not an account identity.
- Expo SQLite is the on-device source of truth. Drizzle owns the typed schema,
  migrations and reactive reads. This works in Expo Go on SDK 57.
- Supabase Postgres is the durable cloud source of truth. Row Level Security
  isolates every user-owned row.
- A durable local outbox synchronizes aggregate commands to Supabase. Saving a
  session never waits for the network.
- TanStack Query can be added for ephemeral HTTP state, but must not become the
  authoritative store for sessions or queued work.
- Strava credentials stay encrypted server-side and never enter SQLite or the
  Expo bundle.

## Local migrations

Generate SQLite migrations with `npm run local-db:generate -- --name <name>`,
then check `drizzle/migrations.js` before committing. drizzle-kit rewrites that
file without the `journal` block the Expo migrator needs, which breaks
typechecking. Restore the journal and add an entry for the new migration.
Never change the `when` value of an entry that has already shipped: the
migrator compares it with the timestamp devices recorded, and a later value
makes the migration run again.

A migration that tightens a constraint must first delete or fix any rows that
would break it. The SQLite rebuild copies every row into the new table, so one
bad row fails the whole migration. `__tests__/local-schema-test.js` has an
example that seeds such rows and runs the migration.

## Domain and storage model

A session is one visit and maps to one Strava activity. Its shape is an
ordered timeline of heat, cold and rest intervals. Adjacency is otherwise
unrestricted: heat can follow heat, cold can follow cold, and a break can
appear anywhere except first. A valid saved session contains at least one heat
or cold interval. See [Session timeline cutover](./session-timeline-cutover.md).

Canonical durations are integer seconds. Temperatures are integer tenths of a
degree Celsius. Unit choice is presentation-only. `heat_seconds` and
`cold_seconds` are active totals, `rest_seconds` is explicitly recorded break
time, and `elapsed_seconds` is wall-clock visit time. Untracked time is the
difference between elapsed time and all recorded intervals.

Every interval lasts at least 30 seconds (`MIN_INTERVAL_SECONDS`). App
validation, the SQLite `session_intervals_min_duration` check and the
matching Postgres check all enforce it. Storage keeps the exact seconds the
timer measured. Rounding happens only for display, so the display rule can
change without a data migration:

- Durations show in steps of 30 seconds, then whole minutes, rounded to the
  nearest step: 30–44 s show as "30 sec", 45–89 s as "1 min", and from 90 s
  the nearest minute, with halves rounding up.
- Totals add up raw seconds and round once. A total can therefore differ from
  the sum of its rounded rows, which is intended.
- `formatStepDuration` (`src/lib/format.ts`) gives the full form ("30 sec",
  "15 min"). `formatStepDurationCompact` gives the compact form (`30″`, `15′`)
  for tight spaces such as the timeline strip.

The synchronized aggregate is:

```text
session
├── optional venue snapshot/reference
└── session_intervals (ordered heat/cold/rest values)
```

Photos and Strava exports have independent workflows because they have different
failure modes and retry requirements.

## Write path

1. A session service validates the draft and calculates totals.
2. One SQLite transaction writes the venue, session, ordered intervals, a
   coalesced `sync_outbox` operation, and removes the consumed draft.
3. Drizzle live queries update the interface immediately.
4. The sync worker runs after the save, on app launch/foreground, and every 30
   seconds while active.
5. `push_session_aggregate` applies the aggregate in one Postgres transaction.
   The authenticated JWT and RLS determine ownership; the client never sends a
   trusted owner identity.
6. A successful response advances the local revision and removes the outbox
   item atomically.

The RPC uses an idempotency key, optimistic base revision and stored response.
An interrupted request can therefore be repeated without creating duplicate
intervals. Transient failures use capped exponential backoff. Revision conflicts
become `action_required` rather than silently overwriting another device.

## Read path

Local SQLite drives every session screen. The server records a monotonic
`sync_changes.sequence` for each session mutation. A cursor pull downloads
changed aggregates and tombstones since `sync_state.pull_cursor`, then applies
each page in a local transaction. The cursor advances only with that commit.

If a remote change targets an aggregate with a local outbox operation, pulling
stops before that change. The next upload either succeeds from the known base
revision or becomes `action_required`; remote data is never silently placed over
an offline edit.

## Account isolation

Every local query includes `user_id`, so accounts on the same device never see
one another’s rows. Remote access is independently protected by RLS. Local data
is not SQLCipher-encrypted because SQLCipher requires a development build and is
not available in Expo Go. Device storage encryption and OS sandboxing are the
current at-rest boundary.

Sign-out and account deletion purge the affected account's SQLite rows. Auth
changes also invalidate active synchronization runs so a response started for a
previous account cannot be applied after an account switch.

Unsaved session handoff data is stored in account-scoped SQLite drafts. Routes
carry only the draft ID; large or sensitive session payloads are never placed
in URLs.

## Strava boundary

The mobile app will invoke Supabase Edge Functions for OAuth and export intent.
A server worker owns token refresh and Strava writes. Strava activity creation
does not accept a per-activity visibility field, so “Keep private” means no
Strava post; posted activities inherit the athlete’s Strava privacy default.

## Source documentation

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- [Expo SDK 57 SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)
- [Drizzle with Expo SQLite](https://orm.drizzle.team/docs/connect-expo-sqlite)
- [Supabase Expo quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native)
- [Supabase API keys](https://supabase.com/docs/guides/api/api-keys)
- [Strava authentication](https://developers.strava.com/docs/authentication/)
- [Strava API reference](https://developers.strava.com/docs/reference/)
