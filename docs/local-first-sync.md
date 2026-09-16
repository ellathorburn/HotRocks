# Local-first sync protocol

## Invariants

- A valid session exists completely or not at all in each database.
- A local save is successful once its SQLite transaction commits.
- Upload retries are safe and cannot duplicate children.
- Deletes are tombstones, not hard deletes.
- The server never trusts a `user_id` supplied in payload JSON.
- Concurrent device edits are detected by revision, not last-write-wins.

## Local tables

`sessions`, `rounds`, `round_parts` and `venues` are queryable domain data.
`sync_outbox` contains durable commands. Its unique key on user, aggregate type
and aggregate ID coalesces repeated offline edits into the latest intended state.
`sync_state` holds the future server cursor and sync diagnostics.

Outbox states:

| State | Meaning |
| --- | --- |
| `pending` | Eligible after `next_attempt_at` |
| `uploading` | Claimed by the current process; stale claims recover after two minutes |
| `action_required` | Server revision conflict; automatic overwrite is stopped |

## Push request

`push_session_aggregate(idempotency_key, operation, payload, base_revision)` is
called with the user’s Supabase access token. The function runs as security
invoker so normal RLS remains active.

For `upsert`, payload version 1 contains the optional venue, session and ordered
rounds with their heat/cold parts. For `delete`, it contains the session ID and
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

- Add two-device conflict and cursor crash-recovery tests.
- Purge local rows during account deletion.
- Add network-reconnect triggering if 30-second foreground retries prove too
  slow; avoid making connectivity detection a correctness dependency.
- Add observability using error codes without session notes, venue names, tokens
  or payload bodies.
