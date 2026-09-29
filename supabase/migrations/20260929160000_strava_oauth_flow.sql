-- In-app Strava connection.
--
-- The athlete authorizes in a browser and Strava redirects to an Edge Function,
-- not back into the app: Strava validates the redirect host against the app's
-- configured callback domain, and Expo Go cannot own a stable custom scheme.
-- The callback therefore has no JWT, so the single-use state nonce is what ties
-- the redirect to an account.

-- 1. State creation and consumption. service_role only: the callback runs
-- without a user, so these must not be reachable by anon or authenticated.
create or replace function public.create_strava_oauth_state(
  p_user_id uuid,
  p_state text,
  p_redirect_uri text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- One pending attempt per athlete; starting again abandons the previous one.
  delete from private.strava_oauth_states where user_id = p_user_id;

  insert into private.strava_oauth_states (id, user_id, redirect_uri, expires_at)
  values (p_state, p_user_id, p_redirect_uri, p_expires_at);
end;
$$;

comment on function public.create_strava_oauth_state is
  'Opens a pending Strava authorization for one athlete. service_role only.';

-- Consuming is a single atomic claim: an expired or replayed state returns
-- nothing, so a captured redirect cannot be used twice.
create or replace function public.consume_strava_oauth_state(p_state text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  update private.strava_oauth_states
  set consumed_at = now()
  where id = p_state
    and consumed_at is null
    and expires_at > now()
  returning user_id into v_user_id;

  return v_user_id;
end;
$$;

comment on function public.consume_strava_oauth_state is
  'Claims a pending Strava authorization once, returning its athlete. service_role only.';

-- 2. What the app is allowed to know about its own connection: that it exists,
-- for which athlete, and with which scopes. Never the tokens.
create or replace function public.my_strava_connection()
returns table (
  athlete_id bigint,
  scopes text[],
  connected_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select connection.athlete_id, connection.scopes, connection.connected_at
  from private.strava_connections as connection
  where connection.user_id = auth.uid()
    and connection.revoked_at is null;
$$;

comment on function public.my_strava_connection is
  'The signed-in athlete''s Strava connection status. Returns no tokens.';

-- Lets an athlete disconnect their own account without exposing anything else.
create or replace function public.disconnect_my_strava()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  delete from private.strava_connections where user_id = v_user_id;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

comment on function public.disconnect_my_strava is
  'Removes the signed-in athlete''s own Strava connection.';

revoke all on function public.create_strava_oauth_state(uuid, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.consume_strava_oauth_state(text)
  from public, anon, authenticated;
revoke all on function public.my_strava_connection() from public, anon;
revoke all on function public.disconnect_my_strava() from public, anon;

grant execute on function public.create_strava_oauth_state(uuid, text, text, timestamptz)
  to service_role;
grant execute on function public.consume_strava_oauth_state(text) to service_role;
grant execute on function public.my_strava_connection() to authenticated, service_role;
grant execute on function public.disconnect_my_strava() to authenticated, service_role;
