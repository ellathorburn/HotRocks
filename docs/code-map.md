# HotRocks code map

This guide shows where types and CRUD operations live using service-oriented
names. Files in `src/app` are Expo Router screens. Screens render data and call
hooks or services; they do not access SQLite or Supabase tables directly.

Frontend developers should start with [Frontend data access](./frontend-data-access.md)
for copyable read/write examples and import rules.

## Where things live

| Concern | Location | Purpose |
| --- | --- | --- |
| Session types | `src/features/sessions/types/session-types.ts` | Interval, timeline, draft, totals, and service-input types |
| Session validation | `src/features/sessions/validation/session-validation.ts` | Zod runtime schemas for the types above, and `MIN_INTERVAL_SECONDS` |
| Display formatting | `src/lib/format.ts` | Durations (30-second then whole-minute steps), temperatures, and dates for screens |
| Permanent session operations | `src/features/sessions/services/session-service.ts` | Public `sessionService.save` and `sessionService.delete` commands |
| Draft operations | `src/features/sessions/services/session-draft-service.ts` | Public timeline draft API, including repeat-a-session |
| Session calculations | `src/features/sessions/services/session-calculation-service.ts` | Pure totals, ordering rules, and carry-forward helpers |
| Session statistics | `src/features/sessions/services/session-statistics-service.ts` | Pure weekly, streak, heatmap, and record calculations |
| Internal SQLite writes | `src/features/sessions/storage/session-storage.ts` | Draft and session persistence used only by services |
| Internal SQLite reads | `src/features/sessions/storage/session-query-storage.ts` | Query builders used only by hooks |
| Screen-facing session state | `src/features/sessions/hooks/` | Reactive, screen-ready data backed by Expo SQLite |
| Profile types | `src/features/profiles/types/profile-types.ts` | Named aliases around generated Supabase profile types |
| Display preferences | `src/features/profiles/hooks/use-display-preferences.ts` | Signed-in user ID, timezone, and temperature unit for screens |
| Profile operations | `src/features/profiles/services/profile-service.ts` | Profile read/create/update operations |
| SQLite table types | `src/services/database/schema.ts` | Drizzle table declarations and inferred local row types |
| Supabase row types | `src/services/supabase/database.types.ts` | Generated remote types; never edit this file by hand |
| Supabase schema and security | `supabase/migrations/` | Tables, database functions, constraints, and RLS policies |
| Offline/cloud synchronization | `src/services/sync/sync-engine.ts` | Pushes queued commands and pulls remote changes |
| Authentication operations | `src/features/auth/auth-service.ts` | Sign-in, sign-up, OAuth, OTP, sign-out, and account deletion |
| Authentication state | `src/features/auth/auth-context.tsx` | Current session/user state; profile work is delegated to `profileService` |
| Screens and routes | `src/app/` | UI and navigation only |

## Public service APIs

Permanent sessions:

```ts
await sessionService.save(input);          // a complete SessionTimeline
await sessionService.saveDraft(input);     // save a draft and consume it atomically
await sessionService.delete(sessionId, userId);
```

Timeline drafts:

```ts
sessionTimelineDraftService.create(userId, input);
sessionTimelineDraftService.createRepeat(userId, sessionId);
sessionTimelineDraftService.get(draftId, userId);
sessionTimelineDraftService.setVenue(draftId, userId, venueName);
sessionTimelineDraftService.addInterval(draftId, userId, interval);
sessionTimelineDraftService.updateInterval(draftId, userId, intervalId, update);
sessionTimelineDraftService.removeInterval(draftId, userId, intervalId);
sessionTimelineDraftService.moveInterval(draftId, userId, intervalId, position);
sessionTimelineDraftService.setElapsedSeconds(draftId, userId, seconds);
sessionTimelineDraftService.delete(draftId, userId);
```

Every draft mutation rejects a timeline that starts with a break. Use
`describeTimelineRuleError(error)` to show the rule's message.

Removing an interval updates a draft; it does not delete the saved session.
`sessionService.delete` soft-deletes the saved session and queues the cloud
tombstone required for offline synchronization.

## Data flow

```text
screen / route
    -> feature hook or small service
        -> validation and calculation services
            -> internal storage module + sync outbox
                -> sync engine
                    -> Supabase protected by RLS
```

The `storage` folder is an internal implementation detail. It plays the role of
the database-access layer but avoids unfamiliar repository terminology. A
service is split when it gains another reason to change: drafts, statistics,
photos, Strava exports, and synchronization must not accumulate in
`sessionService`.
