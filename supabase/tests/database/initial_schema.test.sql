begin;

select plan(26);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'venues', 'venues table exists');
select has_table('public', 'sessions', 'sessions table exists');
select has_table('public', 'rounds', 'rounds table exists');
select has_table('public', 'round_parts', 'round_parts table exists');
select has_table('public', 'session_photos', 'session photos table exists');
select has_table('public', 'strava_exports', 'Strava export status table exists');
select has_table('private', 'strava_connections', 'Strava credentials are private');
select hasnt_table('public', 'strava_connections', 'Strava credentials are not public');

select col_type_is(
  'public',
  'round_parts',
  'duration_seconds',
  'integer',
  'durations use integer seconds'
);
select col_type_is(
  'public',
  'round_parts',
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
  round_count
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
      heat_seconds, cold_seconds, round_count
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
      round_count, rating
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

insert into public.rounds (id, user_id, session_id, position)
values (
  '01HOTROCKSROUND000000000001',
  '10000000-0000-0000-0000-000000000001',
  '01HOTROCKSSESSION0000000001',
  0
);

insert into public.round_parts (
  id, user_id, session_id, round_id, position, kind,
  duration_seconds, temperature_c_tenths
)
values (
  '01HOTROCKSPART0000000000001',
  '10000000-0000-0000-0000-000000000001',
  '01HOTROCKSSESSION0000000001',
  '01HOTROCKSROUND000000000001',
  0,
  'heat',
  900,
  920
);

select is(
  (
    select temperature_c_tenths
    from public.round_parts
    where id = '01HOTROCKSPART0000000000001'
  ),
  920::smallint,
  'a realistic 92 Celsius temperature is stored exactly'
);

select throws_ok(
  $$
    insert into public.round_parts (
      id, user_id, session_id, round_id, position, kind,
      duration_seconds, temperature_c_tenths
    ) values (
      '01DUPLICATEKIND00000000001',
      '10000000-0000-0000-0000-000000000001',
      '01HOTROCKSSESSION0000000001',
      '01HOTROCKSROUND000000000001',
      1,
      'heat',
      120,
      900
    )
  $$,
  '23505',
  null,
  'a round cannot contain two heat parts'
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
  elapsed_seconds, heat_seconds, cold_seconds, round_count
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

insert into public.rounds (id, user_id, session_id, position)
values (
  '01HOTROCKSCOLDROUND0000001',
  '10000000-0000-0000-0000-000000000001',
  '01HOTROCKSCOLDONLY0000001',
  0
);

insert into public.round_parts (
  id, user_id, session_id, round_id, position, kind,
  duration_seconds, temperature_c_tenths
)
values (
  '01HOTROCKSCOLDPART00000001',
  '10000000-0000-0000-0000-000000000001',
  '01HOTROCKSCOLDONLY0000001',
  '01HOTROCKSCOLDROUND0000001',
  0,
  'cold',
  580,
  150
);

select is(
  (
    select count(*)
    from public.round_parts
    where session_id = '01HOTROCKSCOLDONLY0000001' and kind = 'cold'
  ),
  1::bigint,
  'a session can contain one cold-only round'
);

insert into public.rounds (id, user_id, session_id, position)
select
  '01HOTROCKSSIXROUND' || lpad(position::text, 7, '0'),
  '10000000-0000-0000-0000-000000000001',
  '01HOTROCKSSIXROUNDS000001',
  position
from generate_series(0, 5) as position;

insert into public.round_parts (
  id, user_id, session_id, round_id, position, kind,
  duration_seconds, temperature_c_tenths
)
select
  '01HOTROCKSSIXPART' || lpad((round_position * 2 + part_position)::text, 8, '0'),
  '10000000-0000-0000-0000-000000000001',
  '01HOTROCKSSIXROUNDS000001',
  '01HOTROCKSSIXROUND' || lpad(round_position::text, 7, '0'),
  part_position,
  case when part_position = 0 then 'heat' else 'cold' end,
  case when part_position = 0 then 600 else 120 end,
  case when part_position = 0 then 920 else 110 end
from generate_series(0, 5) as round_position
cross join generate_series(0, 1) as part_position;

select is(
  (select count(*) from public.rounds where session_id = '01HOTROCKSSIXROUNDS000001'),
  6::bigint,
  'a six-round session preserves all six logical rounds'
);

select * from finish();
rollback;
