begin;

select plan(12);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '70000000-0000-0000-0000-000000000007',
    'authenticated', 'authenticated', 'oauth-one@example.com', '', now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '80000000-0000-0000-0000-000000000008',
    'authenticated', 'authenticated', 'oauth-two@example.com', '', now(), now(), now()
  );

-- 1. The state functions are server-only. The callback runs with no JWT, so the
-- nonce is the authentication; letting a client mint or claim one would let it
-- attach a Strava account to somebody else.
select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_strava_oauth_state(uuid, text, text, timestamptz)',
    'execute'
  ),
  'an authenticated user cannot mint an authorization state'
);
select ok(
  not has_function_privilege('authenticated', 'public.consume_strava_oauth_state(text)', 'execute'),
  'an authenticated user cannot claim an authorization state'
);
select ok(
  not has_function_privilege('anon', 'public.consume_strava_oauth_state(text)', 'execute'),
  'an anonymous caller cannot claim an authorization state'
);

-- 2. The status function is for the app, so it must be callable, and it must
-- never expose a token.
select ok(
  has_function_privilege('authenticated', 'public.my_strava_connection()', 'execute'),
  'the app can read its own connection status'
);
-- The app must be able to see that it is connected without ever being handed a
-- credential, so the declared return type is the thing to pin down.
select ok(
  (
    select pg_get_function_result(pg_proc.oid) not like '%ciphertext%'
       and pg_get_function_result(pg_proc.oid) not like '%token%'
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public' and pg_proc.proname = 'my_strava_connection'
  ),
  'the status function exposes no token in its return type'
);

set local role service_role;

select lives_ok(
  $$
    select public.create_strava_oauth_state(
      '70000000-0000-0000-0000-000000000007'::uuid,
      'state-one',
      'https://example.supabase.co/functions/v1/strava-callback',
      now() + interval '10 minutes'
    )
  $$,
  'the server opens a pending authorization'
);

select is(
  public.consume_strava_oauth_state('state-one'),
  '70000000-0000-0000-0000-000000000007'::uuid,
  'claiming a state returns the athlete it was created for'
);

-- 3. Single use: a captured redirect must not be replayable.
select is(
  public.consume_strava_oauth_state('state-one'),
  null,
  'the same state cannot be claimed twice'
);

select is(
  public.consume_strava_oauth_state('never-issued'),
  null,
  'an unknown state claims nothing'
);

-- 4. Expiry is enforced, not merely recorded.
select public.create_strava_oauth_state(
  '70000000-0000-0000-0000-000000000007'::uuid,
  'state-expired',
  'https://example.supabase.co/functions/v1/strava-callback',
  now() - interval '1 second'
);

select is(
  public.consume_strava_oauth_state('state-expired'),
  null,
  'an expired state claims nothing'
);

-- 5. Starting again abandons the previous attempt, so a stale redirect that
-- arrives late cannot connect after the athlete restarted the flow.
select public.create_strava_oauth_state(
  '80000000-0000-0000-0000-000000000008'::uuid,
  'state-first',
  'https://example.supabase.co/functions/v1/strava-callback',
  now() + interval '10 minutes'
);
select public.create_strava_oauth_state(
  '80000000-0000-0000-0000-000000000008'::uuid,
  'state-second',
  'https://example.supabase.co/functions/v1/strava-callback',
  now() + interval '10 minutes'
);

select is(
  public.consume_strava_oauth_state('state-first'),
  null,
  'restarting the flow abandons the earlier state'
);
select is(
  public.consume_strava_oauth_state('state-second'),
  '80000000-0000-0000-0000-000000000008'::uuid,
  'the newest state is the one that works'
);

select * from finish();
rollback;
