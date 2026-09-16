# Backend roadmap

## 1. Local Supabase foundation

- [x] Initialize Supabase CLI files.
- [x] Add the first normalized schema.
- [x] Add RLS policies and ownership indexes.
- [x] Add the private photo bucket and object policies.
- [x] Keep anonymous sign-in disabled.
- [x] Run the migration and database tests in local Supabase.
- [x] Generate TypeScript database types.

## 2. Account boundary

- [x] Add the SDK 57-compatible Supabase client.
- [x] Persist the Supabase session securely.
- [x] Add auth routing before onboarding.
- [x] Implement native Apple sign-in on iOS.
- [x] Implement Google PKCE sign-in on iOS and Android.
- [x] Add email OTP fallback.
- [x] Add account deletion and sign-out flows.

The client implementations are complete. Hosted Apple and Google provider
credentials, SMTP and deployment remain environment provisioning tasks; see
`docs/authentication.md`.

Provider credentials are configured later in the hosted Supabase project and
are never committed to the repository.

## 3. Local-first database

- [x] Add PowerSync 2.x with its built-in OP-SQLite adapter.
- [x] Define the PowerSync client schema and indexes.
- [ ] Add authenticated per-user Sync Streams.
- [x] Implement atomic session creation.
- [ ] Implement atomic session editing and soft deletion.
- [ ] Prove save/edit/delete after process restart in airplane mode.

The app now requires an Expo development build on iOS and Android. PowerSync's
native SQLite extension cannot run inside Expo Go. Remote sync is deliberately
not connected until `EXPO_PUBLIC_POWERSYNC_URL` points at a provisioned
PowerSync instance and its per-user Sync Streams have been deployed.

## 4. Photos

- [ ] Copy picked photos from cache to application documents.
- [ ] Normalize and compress photos below the six-megabyte bucket limit.
- [ ] Add a durable local upload outbox.
- [ ] Retry on foreground, reconnect and eligible background execution.

## 5. Strava

- [ ] Implement OAuth state creation and code exchange Edge Functions.
- [ ] Encrypt access and refresh tokens at rest.
- [ ] Add the durable export queue and worker.
- [ ] Add token-refresh locking and rotating refresh-token storage.
- [ ] Add ambiguous-create reconciliation and webhook handling.
- [ ] Add disconnect/revoke.

## 6. Verification gates

- [ ] RLS isolation tests with two users.
- [ ] Database constraint and cascade tests.
- [x] Six-round and cold-only session fixtures.
- [x] Long venue-name fixture.
- [ ] Concurrent Strava refresh tests.
- [ ] Offline photo and session recovery tests.
