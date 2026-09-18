begin;

select plan(10);

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
      "schemaVersion": 2,
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
        "endedAt": "2026-09-16T06:41:00+02:00",
        "timezoneName": "Africa/Johannesburg",
        "elapsedSeconds": 2460,
        "rating": 5,
        "note": "Sauna, break, sauna, plunge.",
        "entryMethod": "manual"
      },
      "intervals": [
        {"id":"01SYNCINTERVAL0000000001","kind":"heat","durationSeconds":900,"temperatureCTenths":920},
        {"id":"01SYNCINTERVAL0000000002","kind":"rest","durationSeconds":300,"temperatureCTenths":null},
        {"id":"01SYNCINTERVAL0000000003","kind":"heat","durationSeconds":900,"temperatureCTenths":900},
        {"id":"01SYNCINTERVAL0000000004","kind":"cold","durationSeconds":160,"temperatureCTenths":110}
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
  (
    select string_agg(kind, ',' order by position)
    from public.session_intervals
    where session_id = '01SYNCSESSION0000000000001'
  ),
  'heat,rest,heat,cold',
  'the aggregate preserves the timeline order'
);

select is(
  (
    select jsonb_build_object(
      'heat', heat_seconds, 'cold', cold_seconds,
      'rest', rest_seconds, 'entries', interval_count
    )
    from public.sessions
    where id = '01SYNCSESSION0000000000001'
  ),
  '{"heat": 1800, "cold": 160, "rest": 300, "entries": 4}'::jsonb,
  'the server derives session totals from the timeline'
);

select throws_ok(
  $$
    select public.push_session_aggregate(
      '01SYNCREQUESTLEADINGBREAK1',
      'upsert',
      $json$
      {
        "schemaVersion": 2,
        "venue": null,
        "session": {
          "id": "01SYNCSESSIONBREAKFIRST001",
          "startedAt": "2026-09-16T06:00:00+02:00",
          "endedAt": "2026-09-16T06:10:00+02:00",
          "timezoneName": "Africa/Johannesburg",
          "elapsedSeconds": 600,
          "entryMethod": "manual"
        },
        "intervals": [
          {"id":"01SYNCBREAKFIRST00000001","kind":"rest","durationSeconds":300,"temperatureCTenths":null},
          {"id":"01SYNCBREAKFIRST00000002","kind":"heat","durationSeconds":300,"temperatureCTenths":900}
        ]
      }
      $json$::jsonb,
      0
    )
  $$,
  '23514',
  null,
  'a session cannot start with a break'
);

select throws_ok(
  $$
    select public.push_session_aggregate(
      '01SYNCREQUESTONLYBREAKS001',
      'upsert',
      $json$
      {
        "schemaVersion": 2,
        "venue": null,
        "session": {
          "id": "01SYNCSESSIONONLYBREAKS001",
          "startedAt": "2026-09-16T06:00:00+02:00",
          "timezoneName": "Africa/Johannesburg",
          "elapsedSeconds": 600,
          "entryMethod": "manual"
        },
        "intervals": [
          {"id":"01SYNCONLYBREAK000000001","kind":"rest","durationSeconds":300,"temperatureCTenths":null}
        ]
      }
      $json$::jsonb,
      0
    )
  $$,
  '23514',
  null,
  'a session of only breaks is rejected'
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
