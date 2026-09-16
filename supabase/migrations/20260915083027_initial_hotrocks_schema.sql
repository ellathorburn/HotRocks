-- HotRocks initial data model.
--
-- Public tables are synchronized to the app and protected with RLS. Strava
-- credentials live in the private schema and are never exposed through the
-- public Data API.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  temperature_unit text not null default 'celsius'
    check (temperature_unit in ('celsius', 'fahrenheit')),
  timezone_name text not null default 'Africa/Johannesburg',
  default_strava_sport_type text not null default 'Workout',
  default_post_to_strava boolean not null default true,
  strava_description_template text not null default E'{rounds}\nHeat {heat_time} · Cold {cold_time}\nPeak heat {peak_heat} · Coldest plunge {coldest_cold}',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.venues (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);

create table public.sessions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  venue_id text,
  venue_name_snapshot text check (
    venue_name_snapshot is null
    or char_length(trim(venue_name_snapshot)) between 1 and 160
  ),
  started_at timestamptz not null,
  ended_at timestamptz,
  timezone_name text not null,
  elapsed_seconds integer not null check (elapsed_seconds > 0),
  heat_seconds integer not null default 0 check (heat_seconds >= 0),
  cold_seconds integer not null default 0 check (cold_seconds >= 0),
  round_count smallint not null check (round_count > 0),
  rating smallint check (rating between 1 and 5),
  note text check (note is null or char_length(note) <= 4000),
  entry_method text not null default 'manual'
    check (entry_method in ('manual', 'timer', 'repeat')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sessions_elapsed_covers_parts
    check (elapsed_seconds >= heat_seconds + cold_seconds),
  constraint sessions_end_after_start
    check (ended_at is null or ended_at >= started_at),
  constraint sessions_venue_owner_fk
    foreign key (venue_id, user_id)
    references public.venues (id, user_id),
  unique (id, user_id)
);

create table public.rounds (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id text not null,
  position smallint not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rounds_session_owner_fk
    foreign key (session_id, user_id)
    references public.sessions (id, user_id) on delete cascade,
  unique (session_id, position),
  unique (session_id, id, user_id),
  unique (id, user_id)
);

-- A round part is the internal heat/cold half of a round. The app never uses
-- this term in user-facing copy.
create table public.round_parts (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id text not null,
  round_id text not null,
  position smallint not null check (position between 0 and 1),
  kind text not null check (kind in ('heat', 'cold')),
  duration_seconds integer not null check (duration_seconds > 0),
  temperature_c_tenths smallint
    check (temperature_c_tenths between -500 and 2000),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint round_parts_round_owner_fk
    foreign key (session_id, round_id, user_id)
    references public.rounds (session_id, id, user_id) on delete cascade,
  constraint round_parts_end_after_start
    check (ended_at is null or started_at is null or ended_at >= started_at),
  unique (round_id, position),
  unique (round_id, kind),
  unique (id, user_id)
);

create table public.session_photos (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id text not null,
  position smallint not null check (position between 0 and 2),
  storage_path text not null,
  thumbnail_path text,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint session_photos_session_owner_fk
    foreign key (session_id, user_id)
    references public.sessions (id, user_id) on delete cascade,
  unique (session_id, position),
  unique (storage_path),
  unique (id, user_id)
);

create table public.strava_exports (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id text not null,
  requested_action text not null default 'post'
    check (requested_action in ('post', 'keep_private')),
  status text not null default 'not_requested'
    check (status in (
      'not_requested',
      'queued',
      'posting',
      'posted',
      'retrying',
      'needs_reconciliation',
      'action_required',
      'disconnected'
    )),
  strava_activity_id bigint,
  payload_snapshot jsonb,
  attempt_count smallint not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  last_error_code text,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strava_exports_session_owner_fk
    foreign key (session_id, user_id)
    references public.sessions (id, user_id) on delete cascade,
  unique (session_id),
  unique (strava_activity_id),
  unique (id, user_id)
);

create table private.strava_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  athlete_id bigint not null unique,
  scopes text[] not null,
  access_token_ciphertext bytea not null,
  refresh_token_ciphertext bytea not null,
  token_key_version smallint not null default 1,
  expires_at timestamptz not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table private.strava_oauth_states (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  redirect_uri text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table private.strava_webhook_events (
  id bigint generated always as identity primary key,
  object_type text not null,
  object_id bigint not null,
  aspect_type text not null,
  owner_id bigint,
  event_time timestamptz not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (object_type, object_id, aspect_type, event_time)
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger venues_set_updated_at
before update on public.venues
for each row execute function private.set_updated_at();

create trigger sessions_set_updated_at
before update on public.sessions
for each row execute function private.set_updated_at();

create trigger rounds_set_updated_at
before update on public.rounds
for each row execute function private.set_updated_at();

create trigger round_parts_set_updated_at
before update on public.round_parts
for each row execute function private.set_updated_at();

create trigger session_photos_set_updated_at
before update on public.session_photos
for each row execute function private.set_updated_at();

create trigger strava_exports_set_updated_at
before update on public.strava_exports
for each row execute function private.set_updated_at();

create trigger strava_connections_set_updated_at
before update on private.strava_connections
for each row execute function private.set_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create unique index venues_user_name_active_idx
  on public.venues (user_id, lower(name))
  where deleted_at is null;
create index venues_user_recent_idx
  on public.venues (user_id, last_used_at desc nulls last)
  where deleted_at is null;
create index sessions_user_started_idx
  on public.sessions (user_id, started_at desc, id desc)
  where deleted_at is null;
create index sessions_venue_id_idx on public.sessions (venue_id);
create index rounds_session_position_idx on public.rounds (session_id, position);
create index rounds_user_id_idx on public.rounds (user_id);
create index round_parts_session_idx on public.round_parts (session_id);
create index round_parts_round_position_idx on public.round_parts (round_id, position);
create index round_parts_user_id_idx on public.round_parts (user_id);
create index session_photos_session_position_idx
  on public.session_photos (session_id, position)
  where deleted_at is null;
create index session_photos_user_id_idx on public.session_photos (user_id);
create index strava_exports_user_status_idx
  on public.strava_exports (user_id, status, next_attempt_at);
create index strava_exports_session_id_idx on public.strava_exports (session_id);
create index strava_oauth_states_user_id_idx
  on private.strava_oauth_states (user_id);
create index strava_oauth_states_expiry_idx
  on private.strava_oauth_states (expires_at)
  where consumed_at is null;
create index strava_webhook_events_pending_idx
  on private.strava_webhook_events (created_at)
  where processed_at is null;

alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.sessions enable row level security;
alter table public.rounds enable row level security;
alter table public.round_parts enable row level security;
alter table public.session_photos enable row level security;
alter table public.strava_exports enable row level security;
alter table private.strava_connections enable row level security;
alter table private.strava_oauth_states enable row level security;
alter table private.strava_webhook_events enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy venues_select_own on public.venues
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy venues_insert_own on public.venues
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy venues_update_own on public.venues
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy venues_delete_own on public.venues
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy sessions_select_own on public.sessions
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy sessions_insert_own on public.sessions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy sessions_update_own on public.sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy sessions_delete_own on public.sessions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy rounds_select_own on public.rounds
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy rounds_insert_own on public.rounds
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy rounds_update_own on public.rounds
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy rounds_delete_own on public.rounds
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy round_parts_select_own on public.round_parts
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy round_parts_insert_own on public.round_parts
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy round_parts_update_own on public.round_parts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy round_parts_delete_own on public.round_parts
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy session_photos_select_own on public.session_photos
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy session_photos_insert_own on public.session_photos
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy session_photos_update_own on public.session_photos
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy session_photos_delete_own on public.session_photos
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy strava_exports_select_own on public.strava_exports
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy strava_exports_insert_own on public.strava_exports
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy strava_exports_update_own on public.strava_exports
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy strava_exports_delete_own on public.strava_exports
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.venues to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert, update, delete on public.rounds to authenticated;
grant select, insert, update, delete on public.round_parts to authenticated;
grant select, insert, update, delete on public.session_photos to authenticated;
grant select, insert, update, delete on public.strava_exports to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'session-photos',
  'session-photos',
  false,
  6291456,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy session_photos_objects_select_own
on storage.objects for select to authenticated
using (
  bucket_id = 'session-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy session_photos_objects_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'session-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy session_photos_objects_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'session-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'session-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy session_photos_objects_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'session-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
