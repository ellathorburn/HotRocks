-- Server-only gateway to private.strava_connections.
--
-- The private schema is not exposed to the Data API, so the Strava worker
-- reaches it through these functions instead. They are security definer and
-- granted to service_role alone: a signed-in user must never be able to read
-- their own Strava tokens, because the app is not allowed to hold them.
--
-- Ciphertext crosses the API as base64 text. The bytea columns stay bytea; only
-- the transport is text, which avoids bytea-over-JSON encoding differences.
-- Encryption and decryption happen in the Edge Function, never here, so the
-- key never reaches Postgres.

create or replace function public.save_strava_connection(
  p_user_id uuid,
  p_athlete_id bigint,
  p_scopes text[],
  p_access_token_ciphertext text,
  p_refresh_token_ciphertext text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.strava_connections (
    user_id, athlete_id, scopes,
    access_token_ciphertext, refresh_token_ciphertext,
    expires_at, revoked_at
  ) values (
    p_user_id,
    p_athlete_id,
    p_scopes,
    decode(p_access_token_ciphertext, 'base64'),
    decode(p_refresh_token_ciphertext, 'base64'),
    p_expires_at,
    null
  )
  on conflict (user_id) do update set
    athlete_id = excluded.athlete_id,
    scopes = excluded.scopes,
    access_token_ciphertext = excluded.access_token_ciphertext,
    refresh_token_ciphertext = excluded.refresh_token_ciphertext,
    expires_at = excluded.expires_at,
    revoked_at = null,
    updated_at = now();
end;
$$;

comment on function public.save_strava_connection is
  'Stores one athlete''s encrypted Strava tokens. service_role only.';

create or replace function public.get_strava_connection(p_user_id uuid)
returns table (
  athlete_id bigint,
  scopes text[],
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  expires_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    connection.athlete_id,
    connection.scopes,
    encode(connection.access_token_ciphertext, 'base64'),
    encode(connection.refresh_token_ciphertext, 'base64'),
    connection.expires_at
  from private.strava_connections as connection
  where connection.user_id = p_user_id
    and connection.revoked_at is null;
$$;

comment on function public.get_strava_connection is
  'Reads one athlete''s encrypted Strava tokens. service_role only.';

-- Strava may return a different refresh token on each refresh, so a rotated
-- pair must be persisted or the next refresh fails with an invalid grant.
create or replace function public.rotate_strava_tokens(
  p_user_id uuid,
  p_access_token_ciphertext text,
  p_refresh_token_ciphertext text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.strava_connections set
    access_token_ciphertext = decode(p_access_token_ciphertext, 'base64'),
    refresh_token_ciphertext = decode(p_refresh_token_ciphertext, 'base64'),
    expires_at = p_expires_at,
    updated_at = now()
  where user_id = p_user_id;
end;
$$;

comment on function public.rotate_strava_tokens is
  'Persists a refreshed Strava token pair. service_role only.';

revoke all on function public.save_strava_connection(uuid, bigint, text[], text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.get_strava_connection(uuid)
  from public, anon, authenticated;
revoke all on function public.rotate_strava_tokens(uuid, text, text, timestamptz)
  from public, anon, authenticated;

grant execute on function public.save_strava_connection(uuid, bigint, text[], text, text, timestamptz)
  to service_role;
grant execute on function public.get_strava_connection(uuid)
  to service_role;
grant execute on function public.rotate_strava_tokens(uuid, text, text, timestamptz)
  to service_role;
