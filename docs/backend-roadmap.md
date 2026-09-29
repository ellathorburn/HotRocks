# Backend roadmap

## 1. Supabase foundation

- [x] Initialize Supabase CLI files and normalized schema.
- [x] Add RLS policies, ownership indexes and private photo storage.
- [x] Keep anonymous sign-in disabled.
- [x] Add aggregate revisions, idempotency receipts and change cursor log.
- [x] Add the atomic `push_session_aggregate` RPC.
- [x] Pass 60 local database tests and database lint.
- [x] Link and deploy migrations to the hosted Supabase project.

## 2. Account boundary

- [x] Add the SDK 57-compatible Supabase client and secure native auth storage.
- [x] Require authentication before onboarding.
- [x] Add Apple, Google PKCE and email OTP sign-in.
- [x] Expose the six-digit email code sign-in screen.
- [x] Add account deletion and sign-out flows.
- [x] Deploy the JWT-protected account-deletion Edge Function.
- [ ] Configure hosted provider credentials, URLs and production SMTP
      (needs the hotrocks.app domain and a verified sender).
- [x] Purge device data after account deletion.

## 3. Expo Go local-first database

- [x] Use Expo SQLite and Drizzle instead of PowerSync/native OP-SQLite.
- [x] Add bundled Drizzle migrations and live queries.
- [x] Write a session aggregate and outbox item atomically.
- [x] Add idempotent upload, revisions, conflict stop and retry backoff.
- [x] Trigger upload after save, at launch, on foreground and while active.
- [x] Show unsynced sessions quietly as “On device”.
- [x] Add atomic session editing.
- [x] Surface revision conflicts and let the owner resolve them.
- [x] Implement cursor-based server pull and tombstones.
- [ ] Prove save/edit/delete after process restart in airplane mode.
- [ ] Add two-device conflict tests.

## 4. Photos

- [ ] Copy picked photos from cache to application documents.
- [ ] Normalize and compress photos below the bucket limit.
- [ ] Add a durable local photo upload outbox.
- [ ] Retry independently from session sync.

## 5. Strava

- [x] Validate the implementation against current Strava API docs.
- [x] Implement OAuth state creation and code exchange Edge Functions.
- [x] Encrypt access and refresh tokens at rest.
- [x] Connect and disconnect from inside the app.
- [x] Post a saved session as an activity, idempotently.
- [x] Persist a rotated refresh token.
- [ ] Add the durable export queue and worker. Posting is currently synchronous:
      it needs the athlete to be online and offers a manual retry, rather than
      queueing and retrying by itself like the session outbox does.
- [ ] Add token-refresh locking and ambiguous-create reconciliation. A request
      that fails after Strava created the activity is not yet reconciled, so a
      retry could duplicate it.
- [ ] Add webhook handling, and revoke the token with Strava on disconnect.
      Disconnecting currently forgets the token locally without telling Strava.

Note: Strava requires an active subscription for Standard-tier API access, and a
new application is limited to one athlete, ten after an unreviewed upgrade.

## 6. Verification gates

- [x] RLS and ownership database tests.
- [x] Constraint, cascade, idempotency and conflict tests.
- [x] Six-round, cold-only and long venue-name fixtures.
- [x] Android production bundle with Expo-compatible modules.
- [ ] Offline process-restart and recovery tests on iOS and Android.
- [ ] Hosted staging sync test with two physical devices.
