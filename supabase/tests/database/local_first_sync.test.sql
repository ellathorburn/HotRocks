begin;

select plan(8);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '30000000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated', 'sync-one@example.com', '', now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '40000000-0000-0000-0000-000000000004',
    'authenticated', 'authenticated', 'sync-two@example.com', '', now(), now(), now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select is(
  public.push_session_aggregate(
    '01SYNCREQUESTCREATE00000001',
    'upsert',
    $json$
    {
      "schemaVersion": 1,
      "venue": {
        "id": "01SYNCVENUE000000000000001",
        "name": "Sea Point Pavilion",
        "lastUsedAt": "2026-09-16T06:30:00+02:00"
      },
      "session": {
        "id": "01SYNCSESSION0000000000001",
        "venueId": "01SYNCVENUE000000000000001",
        "venueNameSnapshot": "Sea Point Pavilion",
        "startedAt": "2026-09-16T06:00:00+02:00",
        "endedAt": "2026-09-16T06:35:20+02:00",
        "timezoneName": "Africa/Johannesburg",
        "elapsedSeconds": 2120,
        "heatSeconds": 1800,
        "coldSeconds": 320,
        "roundCount": 2,
        "rating": 5,
        "note": "Two clean rounds before work.",
        "entryMethod": "manual"
      },
      "rounds": [
        {
          "id": "01SYNCROUND000000000000001",
          "parts": [
            {"id":"01SYNCPART0000000000000001","kind":"heat","durationSeconds":900,"temperatureCTenths":920},
            {"id":"01SYNCPART0000000000000002","kind":"cold","durationSeconds":160,"temperatureCTenths":110}
          ]
        },
        {
          "id": "01SYNCROUND000000000000002",
          "parts": [
            {"id":"01SYNCPART0000000000000003","kind":"heat","durationSeconds":900,"temperatureCTenths":900},
            {"id":"01SYNCPART0000000000000004","kind":"cold","durationSeconds":160,"temperatureCTenths":110}
          ]
        }
      ]
    }
    $json$::jsonb,
    0
  ) ->> 'status',
  'applied',
  'a new offline session aggregate is applied atomically'
);

select is(
  (select count(*) from public.sessions where id = '01SYNCSESSION0000000000001'),
  1::bigint,
  'the aggregate creates exactly one session'
);

select is(
  (select count(*) from public.rounds where session_id = '01SYNCSESSION0000000000001'),
  2::bigint,
  'the aggregate preserves logical rounds'
);

select is(
  (select count(*) from public.round_parts where session_id = '01SYNCSESSION0000000000001'),
  4::bigint,
  'the aggregate preserves every heat and cold entry'
);

select is(
  public.push_session_aggregate(
    '01SYNCREQUESTCREATE00000001',
    'upsert',
    '{}'::jsonb,
    0
  ) ->> 'status',
  'applied',
  'replaying an idempotency key returns the original response'
);

select is(
  public.push_session_aggregate(
    '01SYNCREQUESTCONFLICT00001',
    'upsert',
    jsonb_build_object(
      'session', jsonb_build_object('id', '01SYNCSESSION0000000000001')
    ),
    0
  ) ->> 'status',
  'conflict',
  'a stale base revision is rejected explicitly'
);

select is(
  public.push_session_aggregate(
    '01SYNCREQUESTDELETE0000001',
    'delete',
    jsonb_build_object(
      'sessionId', '01SYNCSESSION0000000000001',
      'deletedAt', '2026-09-16T07:00:00+02:00'
    ),
    1
  ) ->> 'status',
  'deleted',
  'a matching revision creates a synchronized tombstone'
);

select is(
  (select count(*) from public.sync_changes where aggregate_id = '01SYNCSESSION0000000000001'),
  2::bigint,
  'create and delete each append one ordered change event'
);

select * from finish();
rollback;
