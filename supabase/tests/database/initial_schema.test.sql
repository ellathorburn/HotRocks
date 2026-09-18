begin;

select plan(27);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'venues', 'venues table exists');
select has_table('public', 'sessions', 'sessions table exists');
select has_table('public', 'session_intervals', 'session timeline table exists');
select hasnt_table('public', 'rounds', 'the legacy rounds table is removed');
select hasnt_table('public', 'round_parts', 'the legacy round_parts table is removed');
select has_table('public', 'session_photos', 'session photos table exists');
select has_table('public', 'strava_exports', 'Strava export status table exists');
select has_table('private', 'strava_connections', 'Strava credentials are private');
select hasnt_table('public', 'strava_connections', 'Strava credentials are not public');

select col_type_is(
  'public',
  'session_intervals',
  'duration_seconds',
  'integer',
  'durations use integer seconds'
);
select col_type_is(
  'public',
  'session_intervals',
  'temperature_c_tenths',
  'smallint',
  'temperatures use integer tenths Celsius'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'alex@example.com',
    '',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'sam@example.com',
    '',
    now(),
    now(),
    now()
  );

select is(
  (select count(*) from public.profiles),
  2::bigint,
  'a profile is created for every permanent account'
);

insert into public.sessions (
  id,
  user_id,
  venue_name_snapshot,
  started_at,
  timezone_name,
  elapsed_seconds,
  heat_seconds,
  cold_seconds,
  interval_count
)
values
  (
    '01HOTROCKSSESSION0000000001',
    '10000000-0000-0000-0000-000000000001',
    'Sea Point Pavilion',
    '2026-09-15T06:00:00+02:00',
    'Africa/Johannesburg',
    1060,
    900,
    160,
    1
  ),
  (
    '01HOTROCKSSESSION0000000002',
    '20000000-0000-0000-0000-000000000002',
    'Home sauna',
    '2026-09-14T18:00:00+02:00',
    'Africa/Johannesburg',
    900,
    900,
    0,
    1
  );

-- Simulate an interrupted auth trigger so the client can repair only its own
-- profile after authentication.
delete from public.profiles
where user_id = '10000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.sessions),
  1::bigint,
  'RLS only returns the signed-in user sessions'
);
select is(
  (select venue_name_snapshot from public.sessions limit 1),
  'Sea Point Pavilion',
  'RLS returns the expected owner row'
);

insert into public.profiles (user_id)
values ('10000000-0000-0000-0000-000000000001');

select is(
  (select count(*) from public.profiles where user_id = '10000000-0000-0000-0000-000000000001'),
  1::bigint,
  'an authenticated user can repair their own missing profile'
);

select throws_ok(
  $$
    insert into public.profiles (user_id)
    values ('20000000-0000-0000-0000-000000000002')
  $$,
  '42501',
  null,
  'an authenticated user cannot create another account profile'
);

select throws_ok(
  $$
    insert into public.venues (id, user_id, name)
    values (
      '01HOTROCKSVENUE00000000001',
      '20000000-0000-0000-0000-000000000002',
      'Not my venue'
    )
  $$,
  '42501',
  null,
  'RLS rejects writes for another user'
);

reset role;

select throws_ok(
  $$
    insert into public.sessions (
      id, user_id, started_at, timezone_name, elapsed_seconds,
      heat_seconds, cold_seconds, interval_count
    ) values (
      '01INVALIDELAPSED0000000001',
      '10000000-0000-0000-0000-000000000001',
      now(),
      'Africa/Johannesburg',
      60,
      900,
      0,
      1
    )
  $$,
  '23514',
  null,
  'elapsed time cannot be shorter than active time'
);

select throws_ok(
  $$
    insert into public.sessions (
      id, user_id, started_at, timezone_name, elapsed_seconds,
      interval_count, rating
    ) values (
      '01INVALIDRATING0000000002',
      '10000000-0000-0000-0000-000000000001',
      now(),
      'Africa/Johannesburg',
      60,
      1,
      6
    )
  $$,
  '23514',
  null,
  'rating cannot exceed five'
);

insert into public.session_intervals (
  id, user_id, session_id, position, kind,
  duration_seconds, temperature_c_tenths
)
values (
  '01HOTROCKSINTERVAL000000001',
  '10000000-0000-0000-0000-000000000001',
  '01HOTROCKSSESSION0000000001',
  0,
  'heat',
  900,
  920
);

select is(
  (
    select temperature_c_tenths
    from public.session_intervals
    where id = '01HOTROCKSINTERVAL000000001'
  ),
  920::smallint,
  'a realistic 92 Celsius temperature is stored exactly'
);

select throws_ok(
  $$
    insert into public.session_intervals (
      id, user_id, session_id, position, kind,
      duration_seconds, temperature_c_tenths
    ) values (
      '01DUPLICATEPOSITION0000001',
      '10000000-0000-0000-0000-000000000001',
      '01HOTROCKSSESSION0000000001',
      0,
      'cold',
      120,
      110
    )
  $$,
  '23505',
  null,
  'two timeline entries cannot share a position'
);

select is(
  (
    select public
    from storage.buckets
    where id = 'session-photos'
  ),
  false,
  'the session photo bucket is private'
);

select is(
  (
    select file_size_limit
    from storage.buckets
    where id = 'session-photos'
  ),
  6291456::bigint,
  'the session photo bucket has a six MiB limit'
);

insert into public.venues (id, user_id, name)
values (
  '01HOTROCKSLONGVENUE0000001',
  '10000000-0000-0000-0000-000000000001',
  'Allas Sea Pool Helsinki Waterfront and Harbour Sauna'
);

select is(
  (select name from public.venues where id = '01HOTROCKSLONGVENUE0000001'),
  'Allas Sea Pool Helsinki Waterfront and Harbour Sauna',
  'a realistic long venue name is preserved'
);

insert into public.sessions (
  id, user_id, venue_name_snapshot, started_at, timezone_name,
  elapsed_seconds, heat_seconds, cold_seconds, interval_count
)
values
  (
    '01HOTROCKSCOLDONLY0000001',
    '10000000-0000-0000-0000-000000000001',
    'Sea Point Pavilion',
    '2026-09-13T08:05:00+02:00',
    'Africa/Johannesburg',
    580,
    0,
    580,
    1
  ),
  (
    '01HOTROCKSSIXROUNDS000001',
    '10000000-0000-0000-0000-000000000001',
    'Allas Sea Pool Helsinki Waterfront and Harbour Sauna',
    '2026-09-12T07:15:00+02:00',
    'Africa/Johannesburg',
    4320,
    3600,
    720,
    6
  );

insert into public.session_intervals (
  id, user_id, session_id, position, kind,
  duration_seconds, temperature_c_tenths
)
values (
  '01HOTROCKSCOLDINTERVAL0001',
  '10000000-0000-0000-0000-000000000001',
  '01HOTROCKSCOLDONLY0000001',
  0,
  'cold',
  580,
  150
);

select is(
  (
    select count(*)
    from public.session_intervals
    where session_id = '01HOTROCKSCOLDONLY0000001' and kind = 'cold'
  ),
  1::bigint,
  'a session can contain a single cold plunge'
);

insert into public.session_intervals (
  id, user_id, session_id, position, kind,
  duration_seconds, temperature_c_tenths
)
select
  '01HOTROCKSSIXINTERVAL' || lpad(position::text, 5, '0'),
  '10000000-0000-0000-0000-000000000001',
  '01HOTROCKSSIXROUNDS000001',
  position,
  case when position % 2 = 0 then 'heat' else 'cold' end,
  case when position % 2 = 0 then 600 else 120 end,
  case when position % 2 = 0 then 920 else 110 end
from generate_series(0, 11) as position;

select is(
  (select count(*) from public.session_intervals where session_id = '01HOTROCKSSIXROUNDS000001'),
  12::bigint,
  'a long session preserves every timeline entry in order'
);

select * from finish();
rollback;
