alter table public.sessions
  add column revision bigint not null default 1
  check (revision > 0);

create table public.sync_receipts (
  user_id uuid not null references auth.users (id) on delete cascade,
  idempotency_key text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, idempotency_key)
);

create table public.sync_changes (
  sequence bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  aggregate_type text not null check (aggregate_type = 'session'),
  aggregate_id text not null,
  operation text not null check (operation in ('upsert', 'delete')),
  revision bigint not null check (revision > 0),
  changed_at timestamptz not null default now()
);

create index sync_changes_user_sequence_idx
  on public.sync_changes (user_id, sequence);

alter table public.sync_receipts enable row level security;
alter table public.sync_changes enable row level security;

create policy sync_receipts_select_own on public.sync_receipts
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy sync_receipts_insert_own on public.sync_receipts
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy sync_changes_select_own on public.sync_changes
  for select to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert on public.sync_receipts to authenticated;
grant select on public.sync_changes to authenticated;

create or replace function private.record_session_sync_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sync_changes (
    user_id,
    aggregate_type,
    aggregate_id,
    operation,
    revision
  ) values (
    new.user_id,
    'session',
    new.id,
    case when new.deleted_at is null then 'upsert' else 'delete' end,
    new.revision
  );
  return new;
end;
$$;

create trigger sessions_record_sync_change
after insert or update on public.sessions
for each row execute function private.record_session_sync_change();

create or replace function public.push_session_aggregate(
  p_idempotency_key text,
  p_operation text,
  p_payload jsonb,
  p_base_revision bigint default 0
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id text := coalesce(
    p_payload #>> '{session,id}',
    p_payload ->> 'sessionId'
  );
  v_existing_revision bigint;
  v_next_revision bigint;
  v_response jsonb;
  v_venue jsonb := p_payload -> 'venue';
  v_session jsonb := p_payload -> 'session';
  v_round jsonb;
  v_part jsonb;
  v_round_position integer;
  v_part_position integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception 'Invalid idempotency key' using errcode = '22023';
  end if;
  if p_operation not in ('upsert', 'delete') then
    raise exception 'Invalid sync operation' using errcode = '22023';
  end if;
  select response into v_response
  from public.sync_receipts
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  if v_response is not null then
    return v_response;
  end if;

  if v_session_id is null or char_length(v_session_id) = 0 then
    raise exception 'Missing session id' using errcode = '22023';
  end if;

  select revision into v_existing_revision
  from public.sessions
  where id = v_session_id and user_id = v_user_id
  for update;

  if p_operation = 'delete' then
    if v_existing_revision is null then
      v_response := jsonb_build_object(
        'status', 'deleted',
        'sessionId', v_session_id,
        'revision', 0
      );
    elsif p_base_revision <> v_existing_revision then
      return jsonb_build_object(
        'status', 'conflict',
        'sessionId', v_session_id,
        'serverRevision', v_existing_revision
      );
    else
      update public.sessions
      set deleted_at = coalesce((p_payload ->> 'deletedAt')::timestamptz, now()),
          revision = revision + 1
      where id = v_session_id and user_id = v_user_id
      returning revision into v_next_revision;

      v_response := jsonb_build_object(
        'status', 'deleted',
        'sessionId', v_session_id,
        'revision', v_next_revision
      );
    end if;
  else
    if v_session is null then
      raise exception 'Missing session payload' using errcode = '22023';
    end if;
    if v_existing_revision is null and p_base_revision <> 0 then
      return jsonb_build_object(
        'status', 'conflict',
        'sessionId', v_session_id,
        'serverRevision', null
      );
    end if;
    if v_existing_revision is not null and p_base_revision <> v_existing_revision then
      return jsonb_build_object(
        'status', 'conflict',
        'sessionId', v_session_id,
        'serverRevision', v_existing_revision
      );
    end if;

    if v_venue is not null and v_venue <> 'null'::jsonb then
      insert into public.venues (
        id, user_id, name, last_used_at
      ) values (
        v_venue ->> 'id',
        v_user_id,
        v_venue ->> 'name',
        (v_venue ->> 'lastUsedAt')::timestamptz
      )
      on conflict (id) do update set
        name = excluded.name,
        last_used_at = excluded.last_used_at
      where public.venues.user_id = v_user_id;
    end if;

    v_next_revision := coalesce(v_existing_revision + 1, 1);
    insert into public.sessions (
      id, user_id, venue_id, venue_name_snapshot, started_at, ended_at,
      timezone_name, elapsed_seconds, heat_seconds, cold_seconds, round_count,
      rating, note, entry_method, deleted_at, revision
    ) values (
      v_session_id,
      v_user_id,
      nullif(v_session ->> 'venueId', ''),
      nullif(v_session ->> 'venueNameSnapshot', ''),
      (v_session ->> 'startedAt')::timestamptz,
      (v_session ->> 'endedAt')::timestamptz,
      v_session ->> 'timezoneName',
      (v_session ->> 'elapsedSeconds')::integer,
      (v_session ->> 'heatSeconds')::integer,
      (v_session ->> 'coldSeconds')::integer,
      (v_session ->> 'roundCount')::smallint,
      nullif(v_session ->> 'rating', '')::smallint,
      nullif(v_session ->> 'note', ''),
      v_session ->> 'entryMethod',
      null,
      v_next_revision
    )
    on conflict (id) do update set
      venue_id = excluded.venue_id,
      venue_name_snapshot = excluded.venue_name_snapshot,
      started_at = excluded.started_at,
      ended_at = excluded.ended_at,
      timezone_name = excluded.timezone_name,
      elapsed_seconds = excluded.elapsed_seconds,
      heat_seconds = excluded.heat_seconds,
      cold_seconds = excluded.cold_seconds,
      round_count = excluded.round_count,
      rating = excluded.rating,
      note = excluded.note,
      entry_method = excluded.entry_method,
      deleted_at = null,
      revision = excluded.revision
    where public.sessions.user_id = v_user_id;

    delete from public.rounds
    where session_id = v_session_id and user_id = v_user_id;

    for v_round, v_round_position in
      select value, (ordinality - 1)::integer
      from jsonb_array_elements(p_payload -> 'rounds') with ordinality
    loop
      insert into public.rounds (
        id, user_id, session_id, position
      ) values (
        v_round ->> 'id',
        v_user_id,
        v_session_id,
        v_round_position
      );

      for v_part, v_part_position in
        select value, (ordinality - 1)::integer
        from jsonb_array_elements(v_round -> 'parts') with ordinality
      loop
        insert into public.round_parts (
          id, user_id, session_id, round_id, position, kind,
          duration_seconds, temperature_c_tenths
        ) values (
          v_part ->> 'id',
          v_user_id,
          v_session_id,
          v_round ->> 'id',
          v_part_position,
          v_part ->> 'kind',
          (v_part ->> 'durationSeconds')::integer,
          nullif(v_part ->> 'temperatureCTenths', '')::smallint
        );
      end loop;
    end loop;

    v_response := jsonb_build_object(
      'status', 'applied',
      'sessionId', v_session_id,
      'revision', v_next_revision
    );
  end if;

  insert into public.sync_receipts (user_id, idempotency_key, response)
  values (v_user_id, p_idempotency_key, v_response);

  return v_response;
end;
$$;

revoke all on function public.push_session_aggregate(text, text, jsonb, bigint)
  from public, anon;
grant execute on function public.push_session_aggregate(text, text, jsonb, bigint)
  to authenticated;
