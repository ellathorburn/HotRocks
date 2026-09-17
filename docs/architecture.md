# HotRocks architecture

Status: implemented foundation, 16 September 2026.

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

## Domain and storage model

A session is one visit and maps to one Strava activity. Its canonical shape is
an ordered timeline of heat, cold and rest intervals. Adjacency is unrestricted:
heat can follow heat, cold can follow cold, and a recorded break can appear at
any position. A valid saved session contains at least one heat or cold interval.

The interval foundation is additive while the redesigned screens are in
progress. `session_intervals`, the version-two draft contract and their domain
rules are implemented. The current interface still writes the legacy `rounds`
and `round_parts` representation; those tables and its version-one sync payload
must be removed when the screens switch to timeline drafts. New domain code
must not add further round assumptions.

Canonical durations are integer seconds. Temperatures are integer tenths of a
degree Celsius. Unit choice is presentation-only. `heat_seconds` and
`cold_seconds` are active totals, `rest_seconds` is explicitly recorded break
time, and `elapsed_seconds` is wall-clock visit time. Untracked time is the
difference between elapsed time and all recorded intervals.

The synchronized aggregate is:

```text
session
├── optional venue snapshot/reference
└── session_intervals (ordered heat/cold/rest values)
```

Photos and Strava exports have independent workflows because they have different
failure modes and retry requirements.

## Write path

1. A domain command validates the draft and calculates totals.
2. One SQLite transaction writes the venue, session, rounds, round parts and a
   coalesced `sync_outbox` operation.
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
rounds. Transient failures use capped exponential backoff. Revision conflicts
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
