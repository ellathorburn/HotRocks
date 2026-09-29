begin;

select plan(9);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '50000000-0000-0000-0000-000000000005',
    'authenticated', 'authenticated', 'athlete@example.com', '', now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '60000000-0000-0000-0000-000000000006',
    'authenticated', 'authenticated', 'other-athlete@example.com', '', now(), now(), now()
  );

-- 1. The token functions are server-only. A signed-in athlete must never be
-- able to read or write their own Strava tokens: the app is not allowed to
-- hold them, so the grant is the enforcement point.
select ok(
  not has_function_privilege('authenticated', 'public.get_strava_connection(uuid)', 'execute'),
  'an authenticated user cannot read a Strava connection'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.save_strava_connection(uuid, bigint, text[], text, text, timestamptz)',
    'execute'
  ),
  'an authenticated user cannot store a Strava connection'
);
select ok(
  not has_function_privilege('authenticated', 'public.rotate_strava_tokens(uuid, text, text, timestamptz)', 'execute'),
  'an authenticated user cannot rotate Strava tokens'
);
select ok(
  not has_function_privilege('anon', 'public.get_strava_connection(uuid)', 'execute'),
  'an anonymous caller cannot read a Strava connection'
);
select ok(
  has_function_privilege('service_role', 'public.get_strava_connection(uuid)', 'execute'),
  'the server can read a Strava connection'
);

-- 2. Round trip as the server.
set local role service_role;

select lives_ok(
  $$
    select public.save_strava_connection(
      '50000000-0000-0000-0000-000000000005'::uuid,
      12345,
      array['activity:write'],
      encode('sealed-access'::bytea, 'base64'),
      encode('sealed-refresh'::bytea, 'base64'),
      '2026-09-29T13:00:00+00:00'::timestamptz
    )
  $$,
  'the server stores an encrypted connection'
);

select is(
  (
    select jsonb_build_object(
      'athlete', athlete_id,
      'scopes', to_jsonb(scopes),
      'access', convert_from(decode(access_token_ciphertext, 'base64'), 'utf8'),
      'refresh', convert_from(decode(refresh_token_ciphertext, 'base64'), 'utf8')
    )
    from public.get_strava_connection('50000000-0000-0000-0000-000000000005'::uuid)
  ),
  '{"athlete": 12345, "scopes": ["activity:write"], "access": "sealed-access", "refresh": "sealed-refresh"}'::jsonb,
  'ciphertext survives the base64 round trip unchanged'
);

-- 3. Strava may hand back a different refresh token, so a rotation must stick
-- or the next refresh fails with an invalid grant.
select public.rotate_strava_tokens(
  '50000000-0000-0000-0000-000000000005'::uuid,
  encode('rotated-access'::bytea, 'base64'),
  encode('rotated-refresh'::bytea, 'base64'),
  '2026-09-29T19:00:00+00:00'::timestamptz
);

select is(
  (
    select convert_from(decode(refresh_token_ciphertext, 'base64'), 'utf8')
    from public.get_strava_connection('50000000-0000-0000-0000-000000000005'::uuid)
  ),
  'rotated-refresh',
  'a rotated refresh token replaces the stored one'
);

-- 4. A revoked connection reads as absent rather than as stale credentials.
-- Even service_role has no privileges on the private schema, so revoking is
-- done as the owner here; in production it happens inside a definer function.
reset role;

update private.strava_connections
set revoked_at = now()
where user_id = '50000000-0000-0000-0000-000000000005';

set local role service_role;

select is(
  (select count(*) from public.get_strava_connection('50000000-0000-0000-0000-000000000005'::uuid)),
  0::bigint,
  'a revoked connection is not returned'
);

select * from finish();
rollback;
