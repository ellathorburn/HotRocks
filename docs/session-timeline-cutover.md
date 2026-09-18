# Session timeline cutover

Status: complete, 18 September 2026.

Sessions are an ordered timeline of heat (sauna), cold (plunge) and rest
(break) intervals in any combination. The round model has been removed from
the app, SQLite, Supabase and the sync protocol.

## Rules

- A saved session contains at least one heat or cold interval.
- A session cannot start with a break. Drafts, saves and the
  `push_session_aggregate` RPC all reject a leading break, so the rule holds
  for manual logging, the timer, edits, deletes and reorders.
- Breaks never carry a temperature.
- Every interval lasts at least 30 seconds. Manual entry steps through 30 sec,
  1 min, 2 min and so on. The timer does not save an interval shorter than
  30 seconds and asks the user to keep going.
- Elapsed time must cover every recorded interval; any difference is shown as
  untracked time.

User-facing wording for these rules lives in `timelineRuleMessages`
(`src/features/sessions/validation/session-validation.ts`). Screens show the
message returned by `describeTimelineRuleError` rather than writing their own.

## What changed

1. Manual logging (`/log-session`) and the timer write version-two timeline
   drafts through `sessionTimelineDraftService`.
2. `sessionService.save` and `sessionService.saveDraft` write `sessions`,
   `session_intervals`, the venue and the outbox command in one SQLite
   transaction; `saveDraft` also consumes the draft.
3. Push and pull RPCs use the version-two payload (`intervals`). The server
   derives `heat_seconds`, `cold_seconds`, `rest_seconds` and `interval_count`
   from the intervals instead of trusting client totals.
4. Queued version-one upserts from older app builds are upgraded to version two
   by the sync engine before upload.
5. Screen reads go through timeline hooks: `useHomeSessions`,
   `useSessionDetail`, `useShareSession`, `useSessionStatistics`, `useVenues` and
   `useSessionTimelineDraft`.
6. Statistics, detail, share and "Same as last time"
   (`sessionTimelineDraftService.createRepeat`) use intervals.
7. SQLite migration `20260917162743_timeline_cutover` and Supabase migration
   `20260917163000_session_timeline_cutover` convert existing round parts into
   ordered intervals, then drop `rounds`, `round_parts` and `round_count`.
8. SQLite migration `20260918115003_interval_min_duration` and Supabase
   migration `20260918120000_interval_min_duration` raise the minimum interval
   from 1 second to 30 seconds. They permanently delete any session with a
   shorter interval, all of it test data. The SQLite migration also removes
   that session's outbox rows and any draft holding a shorter interval.

## Not yet built

These appear in the design but have no backend yet, so they are not shown:

- Strava connection, posting and the post preview sheet.
- Photos on sessions.
- Sauna duration presets and "carry temperature forward" as settings
  (presets are fixed; the last temperature is always carried forward).
- Drag-to-reorder in the UI. `moveInterval` exists and enforces the break
  rule, but no screen calls it yet.
