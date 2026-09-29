-- Releasing a Strava connection.
--
-- `private.strava_connections.athlete_id` is unique, so one Strava athlete can
-- be bound to only one HotRocks account at a time. Connecting the same athlete
-- to a different account therefore needs the previous binding removed first,
-- and disconnecting needs it regardless.
--
-- service_role only, like the rest of the token gateway: a signed-in user must
-- not be able to reach these rows directly.

create or replace function public.delete_strava_connection(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from private.strava_connections where user_id = p_user_id;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

comment on function public.delete_strava_connection is
  'Removes one account''s Strava connection, freeing the athlete to reconnect. service_role only.';

-- Which account currently holds an athlete, so a reconnect can explain itself
-- instead of failing on a unique violation.
create or replace function public.strava_connection_owner(p_athlete_id bigint)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select user_id
  from private.strava_connections
  where athlete_id = p_athlete_id;
$$;

comment on function public.strava_connection_owner is
  'The account an athlete is bound to, or null. service_role only.';

revoke all on function public.delete_strava_connection(uuid) from public, anon, authenticated;
revoke all on function public.strava_connection_owner(bigint) from public, anon, authenticated;

grant execute on function public.delete_strava_connection(uuid) to service_role;
grant execute on function public.strava_connection_owner(bigint) to service_role;
