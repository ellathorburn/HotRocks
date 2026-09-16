begin;

select plan(7);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '50000000-0000-0000-0000-000000000005',
    'authenticated', 'authenticated', 'pull-one@example.com', '', now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '60000000-0000-0000-0000-000000000006',
    'authenticated', 'authenticated', 'pull-two@example.com', '', now(), now(), now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"50000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);

select public.push_session_aggregate(
  '01PULLREQUESTCREATE00000001',
  'upsert',
  $json$
  {
    "venue": {
      "id": "01PULLVENUE000000000000001",
      "name": "Allas Sea Pool Helsinki Waterfront",
      "lastUsedAt": "2026-09-16T08:00:00Z"
    },
    "session": {
      "id": "01PULLSESSION0000000000001",
      "venueId": "01PULLVENUE000000000000001",
      "venueNameSnapshot": "Allas Sea Pool Helsinki Waterfront",
      "startedAt": "2026-09-16T07:00:00Z",
      "endedAt": "2026-09-16T08:00:00Z",
      "timezoneName": "Europe/Helsinki",
      "elapsedSeconds": 3600,
      "heatSeconds": 2700,
      "coldSeconds": 360,
      "roundCount": 1,
      "rating": 5,
      "note": "Cold morning.",
      "entryMethod": "manual"
    },
    "rounds": [{
      "id": "01PULLROUND000000000000001",
      "parts": [
        {"id":"01PULLPART0000000000000001","kind":"heat","durationSeconds":2700,"temperatureCTenths":920},
        {"id":"01PULLPART0000000000000002","kind":"cold","durationSeconds":360,"temperatureCTenths":110}
      ]
    }]
  }
  $json$::jsonb,
  0
);

select is(
  jsonb_array_length(public.pull_session_changes(0, 50) -> 'changes'),
  1,
  'the owner receives one aggregate change'
);

select is(
  public.pull_session_changes(0, 50) #>> '{changes,0,aggregate,session,id}',
  '01PULLSESSION0000000000001',
  'the pull includes the complete session'
);

select is(
  jsonb_array_length(public.pull_session_changes(0, 50) #> '{changes,0,aggregate,rounds}'),
  1,
  'the pull includes rounds'
);

select is(
  jsonb_array_length(public.pull_session_changes(0, 50) #> '{changes,0,aggregate,rounds,0,parts}'),
  2,
  'the pull includes heat and cold values'
);

select ok(
  (public.pull_session_changes(0, 50) ->> 'nextCursor')::bigint > 0,
  'the pull returns a monotonic cursor'
);

select is(
  public.pull_session_changes(0, 50) ->> 'hasMore',
  'false',
  'the pull reports a complete page'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);

select is(
  jsonb_array_length(public.pull_session_changes(0, 50) -> 'changes'),
  0,
  'another user cannot pull the aggregate'
);

select * from finish();
rollback;
