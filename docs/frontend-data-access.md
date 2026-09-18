# Frontend data access

This is the working guide for reading and changing HotRocks data from an Expo
Router screen or React component.

## The short version

- Use a feature **hook** to read reactive data.
- Use a feature **service** inside an event handler to change data.
- Use `useAuth()` for the signed-in user, profile, and profile updates.
- Pass the current `user.id` into every account-scoped hook or service.
- Never import SQLite, Drizzle tables, a storage module, the sync engine, or the
  Supabase client into a screen.

```text
screen
  -> hook for reads
  -> service for writes
      -> validation
      -> local storage and sync outbox
          -> background Supabase synchronization
```

## Imports allowed in screens

Screens may import:

```ts
import { useAuth } from '@/features/auth/auth-context';
import { useHomeSessions } from '@/features/sessions/hooks/use-home-sessions';
import { sessionService } from '@/features/sessions/services/session-service';
import type { SessionInterval } from '@/features/sessions/types/session-types';
```

Screens must not import:

```ts
// Do not use these from src/app or UI components.
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { database } from '@/services/database/client';
import { sessions } from '@/services/database/schema';
import { getSupabaseClient } from '@/services/supabase/client';
import { sessionStorage } from '@/features/sessions/storage/session-storage';
```

If a screen cannot get the data it needs through an existing hook or service,
extend the feature layer instead of querying storage from the screen.

## Authentication and account scope

Read authentication and profile state through `useAuth()`:

```tsx
const {
  user,
  profile,
  isLoading,
  error,
  retry,
  updateProfile,
} = useAuth();
```

The application route guard normally prevents authenticated screens from being
shown without a user. Hooks must still be called unconditionally because they
are React hooks:

```tsx
const { user, profile } = useAuth();
const userId = user?.id ?? '';
const timeZone = profile?.timezone_name
  ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  ?? 'UTC';

const data = useHomeSessions(userId, timeZone);
```

Most session hooks take the result of `useDisplayPreferences()` instead, which
bundles the user ID, timezone, and temperature unit:

```tsx
const preferences = useDisplayPreferences();
const { cards, week, lastSession } = useHomeSessions(preferences);
```

Temperatures are stored as tenths of a degree Celsius. Hooks return them
already converted to the account's unit; use `formatTemperature` from
`@/lib/format` for any value you format yourself.

Do not wrap the hook in `if (user)`. An empty `userId` produces no matching
account rows while React keeps a stable hook order.

Every service write must use the authenticated user's ID. Never accept a user
ID from route parameters or form input.

## Reading session data

All session hooks subscribe to local Expo SQLite data. Components rerender when
the relevant local rows change, including immediately after an offline write or
background synchronization.

### Home feed and weekly summary

```tsx
const { user, profile } = useAuth();
const userId = user?.id ?? '';
const timeZone = profile?.timezone_name ?? 'UTC';
const { cards, week, lastSession, isLoaded } = useHomeSessions(preferences);
```

Returns:

- `cards`: screen-ready session cards, including segments and sync state.
- `week`: session, sauna, plunge and break totals for the current
  Monday-based week in the supplied timezone.
- `lastSession`: the most recent session, offered as "Same as last time".
- `isLoaded`: whether the first local query has completed.

### Profile statistics

```tsx
const statistics = useSessionStatistics(preferences);
```

Returns lifetime sauna, plunge and break totals, this-month count, current
weekly streak, heatmap data, and formatted records.

### Session detail and share card

```tsx
const {
  session, segments, entries, composition, totals,
  totalTime, date, stravaExport, isPendingSync, isLoaded,
} = useSessionDetail(sessionId, preferences);
```

`useShareSession` returns the same view model. `session` is `null` while
loading and when no owned, non-deleted session exists. Only show a "not found"
state after `isLoaded` is true.

### Timeline draft

```tsx
const {
  draft, entries, segments, composition, totals,
  allowedKinds, canSave, isLoaded,
} = useSessionTimelineDraft(draftId, preferences);
```

`allowedKinds` and `canSave` come from the timeline rules; use them to decide
which activities to offer and whether Save is enabled. Treat `draft === null`
after loading as missing or invalid data.

### Venues

```tsx
const venues = useVenues(preferences);
```

Account-scoped, excluding deleted venues, ordered by recent use, each with a
`meta` line (session count, last used, "Cold only") derived from sessions.

## Writing session data

Services validate their input and own persistence and synchronization. Call
them from button handlers or other user-triggered actions.

### Save a draft as a session

```tsx
const handleSave = async () => {
  setIsSaving(true);
  setError(null);
  try {
    const sessionId = await sessionService.saveDraft({
      sessionId: createId(),
      draftId,
      userId: preferences.userId,
      timezoneName: preferences.timeZone,
      rating: rating || null,
      note: note.trim() || null,
    });
    router.replace(`/session/${sessionId}`);
  } catch (error) {
    setError(describeTimelineRuleError(error) ?? 'Could not save this session. Try again.');
    setIsSaving(false);
  }
};
```

`saveDraft` validates the timeline, commits the session, its intervals and its
sync-outbox command, and deletes the draft, all in one local transaction. It
does not wait for the network. Do not call the sync engine separately.

### Delete a saved session

```tsx
await sessionService.delete(sessionId, preferences.userId);
```

This is an offline-safe soft delete. The service queues the cloud tombstone.

## Editing drafts

```ts
const draftId = sessionTimelineDraftService.create(userId, {
  intervals: [],
  venueName: null,
  rating: null,
  note: null,
  startedAt: new Date().toISOString(),
  elapsedSeconds: 0,
  entryMethod: 'manual',
});

sessionTimelineDraftService.addInterval(draftId, userId, toSessionInterval({
  id: createId(),
  kind: 'heat',
  durationSeconds: 900,
  temperatureCTenths: 900,
}));
```

Build intervals with `toSessionInterval` so a break never carries a
temperature. `durationSeconds` must be at least `MIN_INTERVAL_SECONDS` (30).
Store exact seconds and format them with `formatStepDuration` for display;
never round before saving. Every mutation throws if it would leave a break at the start of
the timeline; catch it and show `describeTimelineRuleError(error)`.

Use `useSessionTimelineDraft` for data a screen renders. The synchronous `.get`
is for event handlers and services, not render.

## Updating the profile

Screens update the profile through `useAuth()` so the context state updates at
the same time as Supabase:

```tsx
const { updateProfile } = useAuth();

await updateProfile({
  temperature_unit: 'fahrenheit',
});
```

Do not call `profileService` or Supabase directly from a screen. The auth
provider uses `profileService` internally and exposes the correct UI API.

## Loading and errors

- Use a hook's `isLoaded` before deciding that a local record does not exist.
- Use `useAuth().isLoading` for initial authentication/profile loading.
- Disable repeated write actions while a promise is running.
- Catch service errors at the screen boundary and show an actionable message.
- Log technical detail only in development; do not expose raw database or
  Supabase messages as the primary user-facing explanation.
- Do not optimistically navigate before a local service write succeeds.

## Adding a new frontend data requirement

For a new reactive read:

1. Add an account-scoped query builder under
   `src/features/<feature>/storage/`.
2. Consume it with `useLiveQuery` in a feature hook under `hooks/`.
3. Return screen-ready data from the hook.
4. Import only the hook from the screen.

For a new write:

1. Add or extend the application type and Zod validation.
2. Add the smallest required storage operation under `storage/`.
3. Expose a readable operation from a focused service.
4. Queue synchronization in the same local transaction when cloud persistence
   is required.
5. Call only the service from the screen.

Do not put statistics, formatting, navigation, photo workflows, Strava logic,
and CRUD into one service. Create another focused service when the reason for
change is different.

## Security boundary

The mobile application is an untrusted client. Passing `userId` scopes local
SQLite data on a shared device, but it is not remote authorization. Supabase
uses the authenticated JWT and Row Level Security to authorize remote rows.

Never ship a Supabase secret/service-role key in the Expo application, and
never use editable user metadata as an authorization source. Generated remote
types live in `src/services/supabase/database.types.ts` and must not be edited
by hand.

## Reference implementation

- Home read and repeat: `src/app/(tabs)/index.tsx`
- Timeline entry form: `src/app/log-session.tsx`
- Timer to draft: `src/app/(tabs)/timer.tsx`
- Statistics read: `src/app/(tabs)/profile.tsx`
- Detail read and delete: `src/app/session/[id].tsx`
- Draft read and save: `src/app/session/summary.tsx`
- Venue read and draft update: `src/app/venue-picker.tsx`
- Service/storage map: [Code map](./code-map.md)

External references:

- [Expo SDK 57 SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)
- [Expo Router introduction](https://docs.expo.dev/router/introduction/)
- [Supabase sessions](https://supabase.com/docs/guides/auth/sessions)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
