alter table public.sessions
  add column rest_seconds integer not null default 0
    check (rest_seconds >= 0),
  add column interval_count integer not null default 0
    check (interval_count >= 0);

alter table public.sessions
  add constraint sessions_elapsed_covers_intervals
  check (elapsed_seconds >= heat_seconds + cold_seconds + rest_seconds);

create table public.session_intervals (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id text not null,
  position integer not null check (position >= 0),
  kind text not null check (kind in ('heat', 'cold', 'rest')),
  duration_seconds integer not null check (duration_seconds > 0),
  temperature_c_tenths smallint
    check (temperature_c_tenths between -500 and 2000),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_intervals_session_owner_fk
    foreign key (session_id, user_id)
    references public.sessions (id, user_id) on delete cascade,
  constraint session_intervals_rest_has_no_temperature
    check (kind <> 'rest' or temperature_c_tenths is null),
  constraint session_intervals_end_after_start
    check (ended_at is null or started_at is null or ended_at >= started_at),
  unique (session_id, position),
  unique (id, user_id)
);

create index session_intervals_user_id_idx
  on public.session_intervals (user_id);

create trigger session_intervals_set_updated_at
before update on public.session_intervals
for each row execute function private.set_updated_at();

alter table public.session_intervals enable row level security;

create policy session_intervals_select_own on public.session_intervals
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy session_intervals_insert_own on public.session_intervals
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy session_intervals_update_own on public.session_intervals
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy session_intervals_delete_own on public.session_intervals
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete
  on public.session_intervals to authenticated;
