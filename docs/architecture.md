# HotRocks architecture

Status: accepted foundation, 15 September 2026.

## Decisions

- Every user must create a permanent HotRocks account before onboarding completes.
- Apple and Google are the primary sign-in methods. Email OTP is the fallback.
- Strava is an optional integration, not an account identity.
- The mobile database is local-first. Final architecture uses PowerSync over
  SQLite with Supabase Postgres as the cloud source of truth.
- PowerSync 2.x supplies the OP-SQLite integration directly; the obsolete
  `@powersync/op-sqlite` adapter package must not be installed beside it.
- TanStack Query may manage short-lived server commands, but it is not the
  authoritative store for sessions.
- All user-owned database rows are protected by Supabase Row Level Security.
- Strava credentials are encrypted server-side and never synchronized to a
  device.
- Supabase OAuth uses authorization code flow with PKCE. Native session data is
  stored in Expo SecureStore; the app never contains provider or service-role
  secrets.

## Domain language

A session is one visit and maps to one Strava activity. A round is one pass
through heat, cold, or both. `round_parts` is the internal table for the heat
or cold half of a round; this implementation name never appears in the user
interface.

Canonical values are stored as integer seconds and tenths of a degree Celsius.
The selected temperature unit is a presentation preference.

## Data flow

1. Screens call domain commands rather than Supabase directly.
2. Domain commands write sessions and their child rows to local SQLite in one
   transaction.
3. PowerSync uploads those mutations and downloads changes belonging to the
   authenticated user.
4. Photos are copied into durable local app storage and uploaded separately to
   the private `session-photos` bucket.
5. A finalized `strava_exports` row causes a server-side queue job. An Edge
   Function refreshes the athlete token and creates the manual Strava activity.
6. Strava status synchronizes back quietly and never blocks saving a session.

## Current implementation boundary

`src/services/powersync/schema.ts` mirrors the synchronized public tables and
adds a local-only session draft table. `saveSession` creates or recalls a venue
and writes the session, its logical rounds, and their heat/cold data atomically.
Home subscribes to those local tables, so a completed save is visible without
a network round trip.

Remote upload/download is the next boundary. It requires a PowerSync service
URL plus authenticated Sync Streams. Until then the database is durable local
storage and `connect()` is intentionally not called.

## Time semantics

`heat_seconds` and `cold_seconds` are active training totals. `elapsed_seconds`
is the whole visit and must be at least their sum. Timer sessions calculate true
wall-clock elapsed time. Until the summary interaction is finalized, manual
sessions default elapsed time to the sum of their entered round parts.

## Strava privacy

Strava's activity create and update APIs do not accept a visibility field.
"Keep private" therefore means keep the session in HotRocks without creating a
Strava activity. Posted activities inherit the athlete's Strava privacy default.

## Source documentation

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- [Expo SDK 57 SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)
- [Supabase Expo quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native)
- [Supabase Auth with Expo](https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth)
- [PowerSync React Native and Expo](https://docs.powersync.com/client-sdks/reference/react-native-and-expo)
- [Strava authentication](https://developers.strava.com/docs/authentication/)
- [Strava API reference](https://developers.strava.com/docs/reference/)
