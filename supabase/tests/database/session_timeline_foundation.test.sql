begin;

select plan(8);

select has_table('public', 'session_intervals', 'session timeline table exists');
select has_column('public', 'sessions', 'rest_seconds', 'sessions track recorded break time');
select has_column('public', 'sessions', 'interval_count', 'sessions track timeline entry count');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '50000000-0000-0000-0000-000000000005',
    'authenticated', 'authenticated', 'timeline-one@example.com', '', now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '60000000-0000-0000-0000-000000000006',
    'authenticated', 'authenticated', 'timeline-two@example.com', '', now(), now(), now()
  );

insert into public.sessions (
  id, user_id, started_at, timezone_name, elapsed_seconds,
  heat_seconds, cold_seconds, rest_seconds, interval_count
)
values
  (
    '01TIMELINESESSION0000000001',
    '50000000-0000-0000-0000-000000000005',
    '2026-09-17T08:00:00+02:00',
    'Africa/Johannesburg',
    2280, 1620, 180, 480, 5
  ),
  (
    '01TIMELINESESSION0000000002',
    '60000000-0000-0000-0000-000000000006',
    '2026-09-17T09:00:00+02:00',
    'Africa/Johannesburg',
    300, 300, 0, 0, 1
  );

insert into public.session_intervals (
  id, user_id, session_id, position, kind, duration_seconds, temperature_c_tenths
)
values
  ('01TIMELINEINTERVAL000000001', '50000000-0000-0000-0000-000000000005', '01TIMELINESESSION0000000001', 0, 'heat', 900, 900),
  ('01TIMELINEINTERVAL000000002', '50000000-0000-0000-0000-000000000005', '01TIMELINESESSION0000000001', 1, 'rest', 480, null),
  ('01TIMELINEINTERVAL000000003', '50000000-0000-0000-0000-000000000005', '01TIMELINESESSION0000000001', 2, 'heat', 720, 950),
  ('01TIMELINEINTERVAL000000004', '50000000-0000-0000-0000-000000000005', '01TIMELINESESSION0000000001', 3, 'cold', 120, 100),
  ('01TIMELINEINTERVAL000000005', '50000000-0000-0000-0000-000000000005', '01TIMELINESESSION0000000001', 4, 'cold', 60, 80),
  ('01TIMELINEINTERVAL000000006', '60000000-0000-0000-0000-000000000006', '01TIMELINESESSION0000000002', 0, 'heat', 300, null);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"50000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);

select is(
  (select string_agg(kind, ',' order by position) from public.session_intervals),
  'heat,rest,heat,cold,cold',
  'the timeline preserves arbitrary order and repeated activity types'
);

select is(
  (select count(*) from public.session_intervals),
  5::bigint,
  'RLS hides another account timeline entries'
);

select throws_ok(
  $$
    insert into public.session_intervals (
      id, user_id, session_id, position, kind, duration_seconds, temperature_c_tenths
    ) values (
      '01TIMELINEINVALIDREST00001',
      '50000000-0000-0000-0000-000000000005',
      '01TIMELINESESSION0000000001',
      5, 'rest', 60, 250
    )
  $$,
  '23514',
  null,
  'a recorded break cannot carry a temperature'
);

select throws_ok(
  $$
    insert into public.session_intervals (
      id, user_id, session_id, position, kind, duration_seconds, temperature_c_tenths
    ) values (
      '01TIMELINESHORTENTRY000001',
      '50000000-0000-0000-0000-000000000005',
      '01TIMELINESESSION0000000001',
      5, 'cold', 29, 100
    )
  $$,
  '23514',
  null,
  'an entry must last at least 30 seconds'
);

select throws_ok(
  $$
    insert into public.session_intervals (
      id, user_id, session_id, position, kind, duration_seconds, temperature_c_tenths
    ) values (
      '01TIMELINEOTHEROWNER000001',
      '60000000-0000-0000-0000-000000000006',
      '01TIMELINESESSION0000000002',
      1, 'cold', 60, 100
    )
  $$,
  '42501',
  null,
  'RLS rejects timeline writes for another account'
);

select * from finish();
rollback;
