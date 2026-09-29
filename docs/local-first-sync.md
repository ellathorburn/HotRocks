# Local-first sync protocol

## Invariants

- A valid session exists completely or not at all in each database.
- A local save is successful once its SQLite transaction commits.
- Upload retries are safe and cannot duplicate children.
- Deletes are tombstones, not hard deletes.
- The server never trusts a `user_id` supplied in payload JSON.
- Concurrent device edits are detected by revision, not last-write-wins.

## Local tables

`sessions`, `session_intervals` and `venues` are queryable domain data.
`sync_outbox` contains durable commands. Its unique key on user, aggregate type
and aggregate ID coalesces repeated offline edits into the latest intended state.
`sync_state` holds the future server cursor and sync diagnostics.

Outbox states:

| State | Meaning |
| --- | --- |
| `pending` | Eligible after `next_attempt_at` |
| `uploading` | Claimed by the current process; stale claims recover after two minutes |
| `action_required` | Server revision conflict; automatic overwrite is stopped, and `conflict_server_revision` records the revision the server held |

## Push request

`push_session_aggregate(idempotency_key, operation, payload, base_revision)` is
called with the user’s Supabase access token. The function runs as security
invoker so normal RLS remains active.

For `upsert`, payload version 2 contains the optional venue, the session and its
ordered `intervals` (heat, cold or rest). The server derives the session's
heat, cold and rest totals and interval count from the intervals, and rejects a
timeline with no heat or cold interval or one that starts with a break. Queued
version-1 (round-shaped) upserts from older builds are converted to version 2 by
the client before upload. For `delete`, the payload contains the session ID and
deletion timestamp. A new local aggregate has base revision 0. Each accepted
server mutation increments revision.

The server stores the completed response against the idempotency key. If the
client loses the response, its retry receives the original result. When a newer
local mutation arrives during an in-flight request, the worker preserves that
outbox row and advances its base revision before retrying.

## Pull protocol

`sync_changes` is an append-only, per-user cursor log populated by a private
trigger. Pull does the following:

1. Request changes after the local cursor in bounded pages.
2. Fetch each current aggregate, or apply a tombstone for deletes.
3. Refuse to overwrite an aggregate with a pending local outbox command.
4. Apply the page and new cursor in one SQLite transaction.
5. Repeat until the page is short.

The cursor advances only with the corresponding local changes. This prevents a
crash from skipping server data.

Step 3 refuses on any queued command, including one parked as
`action_required`. A conflict therefore stops the pull at that sequence for the
whole account, not just for the conflicted session, and it stays stopped until
the conflict is resolved. That is deliberate — the alternative is overwriting an
offline edit — but it means a conflict must be surfaced to the user rather than
logged, and must always have a way out.

## Conflict resolution

A revision conflict cannot be settled automatically: both outcomes discard
somebody's work, so the owner chooses. `resolveSessionConflict(userId,
sessionId, resolution)` applies that choice and resumes synchronization.

| Resolution | Effect |
| --- | --- |
| `keep-local` | Rebases the queued command onto `conflict_server_revision` and requeues it as `pending`. The retry overwrites the other device's version. |
| `use-remote` | Deletes the queued command, discarding this device's edit. The pull unblocks and the server's version replaces the local rows on the next successful pull. |

`keep-local` reuses the original outbox ID, which is also the idempotency key.
That is safe because a conflict returns before the RPC stores a receipt, so the
key is still unused and the retry is processed fresh.

A conflict is also cleared by editing the session again: the new command
replaces the parked one, resets the attempt count and clears
`conflict_server_revision`.

## Failure behavior

| Failure | Result |
| --- | --- |
| Offline / timeout / 5xx | Keep local save; exponential retry |
| App killed during upload | Recover stale `uploading` claim |
| Response lost after server commit | Repeat key returns stored response |
| Same session edited elsewhere | Mark `action_required` |
| Invalid payload / auth | Preserve outbox diagnostics; do not lose local data |
| Photo upload fails | Session sync continues independently |
| Strava fails | Session remains saved and export retries independently |

## Production gates

- Add two-device conflict and cursor crash-recovery tests against real devices.
  `__tests__/sync-conflict-test.js` covers resolution against local SQLite, not
  two devices racing a live server.
- Purge local rows during account deletion.
- Add network-reconnect triggering if 30-second foreground retries prove too
  slow; avoid making connectivity detection a correctness dependency.
- Add observability using error codes without session notes, venue names, tokens
  or payload bodies.
