-- Session timeline cutover.
--
-- Sessions become an ordered timeline of heat, cold and rest intervals. Existing
-- round parts are converted into intervals, the aggregate RPCs switch to the
-- version-two payload, and the round tables are removed.

-- 1. Preserve existing data as ordered intervals.
insert into public.session_intervals (
  id, user_id, session_id, position, kind, duration_seconds,
  temperature_c_tenths, started_at, ended_at, created_at, updated_at
)
select
  rp.id,
  rp.user_id,
  rp.session_id,
  (row_number() over (
    partition by rp.session_id
    order by r.position, rp.position
  ) - 1)::integer,
  rp.kind,
  rp.duration_seconds,
  rp.temperature_c_tenths,
  rp.started_at,
  rp.ended_at,
  rp.created_at,
  rp.updated_at
from public.round_parts rp
join public.rounds r
  on r.id = rp.round_id and r.user_id = rp.user_id
where not exists (
  select 1 from public.session_intervals si where si.session_id = rp.session_id
);

update public.sessions s
set interval_count = counted.total
from (
  select session_id, count(*)::integer as total
  from public.session_intervals
  group by session_id
) counted
where counted.session_id = s.id
  and s.interval_count <> counted.total;

-- 2. Remove the round model.
drop table public.round_parts;
drop table public.rounds;

alter table public.sessions
  drop constraint sessions_elapsed_covers_parts,
  drop column round_count;

-- Break descriptions replace round counts in the Strava template placeholders.
alter table public.profiles
  alter column strava_description_template set default
    E'{composition}\nSauna {heat_time} · Cold {cold_time} · Break {rest_time}\nPeak sauna {peak_heat} · Coldest plunge {coldest_cold}';

update public.profiles
set strava_description_template =
  E'{composition}\nSauna {heat_time} · Cold {cold_time} · Break {rest_time}\nPeak sauna {peak_heat} · Coldest plunge {coldest_cold}'
where strava_description_template =
  E'{rounds}\nHeat {heat_time} · Cold {cold_time}\nPeak heat {peak_heat} · Coldest plunge {coldest_cold}';

-- 3. Version-two aggregate push. Totals are derived from the intervals so a
-- client cannot store inconsistent summary columns.
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
  v_intervals jsonb := p_payload -> 'intervals';
  v_heat_seconds integer;
  v_cold_seconds integer;
  v_rest_seconds integer;
  v_interval_count integer;
  v_active_count integer;
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

    if coalesce((p_payload ->> 'schemaVersion')::integer, 0) <> 2 then
      raise exception 'Unsupported session payload version' using errcode = '22023';
    end if;
    if v_session is null or jsonb_typeof(v_session) <> 'object' then
      raise exception 'Missing session payload' using errcode = '22023';
    end if;
    if v_intervals is null or jsonb_typeof(v_intervals) <> 'array' then
      raise exception 'Missing session intervals' using errcode = '22023';
    end if;

    select
      coalesce(sum((value ->> 'durationSeconds')::integer) filter (where value ->> 'kind' = 'heat'), 0),
      coalesce(sum((value ->> 'durationSeconds')::integer) filter (where value ->> 'kind' = 'cold'), 0),
      coalesce(sum((value ->> 'durationSeconds')::integer) filter (where value ->> 'kind' = 'rest'), 0),
      count(*)::integer,
      (count(*) filter (where value ->> 'kind' in ('heat', 'cold')))::integer
    into v_heat_seconds, v_cold_seconds, v_rest_seconds, v_interval_count, v_active_count
    from jsonb_array_elements(v_intervals);

    if v_active_count = 0 then
      raise exception 'A session must include at least one sauna or cold plunge'
        using errcode = '23514';
    end if;
    if v_intervals #>> '{0,kind}' = 'rest' then
      raise exception 'A session cannot start with a break' using errcode = '23514';
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
      timezone_name, elapsed_seconds, heat_seconds, cold_seconds,
      rest_seconds, interval_count, rating, note, entry_method,
      deleted_at, revision
    ) values (
      v_session_id,
      v_user_id,
      nullif(v_session ->> 'venueId', ''),
      nullif(v_session ->> 'venueNameSnapshot', ''),
      (v_session ->> 'startedAt')::timestamptz,
      (v_session ->> 'endedAt')::timestamptz,
      v_session ->> 'timezoneName',
      (v_session ->> 'elapsedSeconds')::integer,
      v_heat_seconds,
      v_cold_seconds,
      v_rest_seconds,
      v_interval_count,
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
      rest_seconds = excluded.rest_seconds,
      interval_count = excluded.interval_count,
      rating = excluded.rating,
      note = excluded.note,
      entry_method = excluded.entry_method,
      deleted_at = null,
      revision = excluded.revision
    where public.sessions.user_id = v_user_id;

    delete from public.session_intervals
    where session_id = v_session_id and user_id = v_user_id;

    insert into public.session_intervals (
      id, user_id, session_id, position, kind, duration_seconds, temperature_c_tenths
    )
    select
      value ->> 'id',
      v_user_id,
      v_session_id,
      (ordinality - 1)::integer,
      value ->> 'kind',
      (value ->> 'durationSeconds')::integer,
      nullif(value ->> 'temperatureCTenths', '')::smallint
    from jsonb_array_elements(v_intervals) with ordinality;

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

-- 4. Version-two aggregate pull.
create or replace function public.pull_session_changes(
  p_after_sequence bigint default 0,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_change record;
  v_aggregate jsonb;
  v_changes jsonb := '[]'::jsonb;
  v_next_cursor bigint := greatest(p_after_sequence, 0);
  v_has_more boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_after_sequence < 0 then
    raise exception 'Invalid cursor' using errcode = '22023';
  end if;
  if p_limit < 1 or p_limit > 100 then
    raise exception 'Limit must be between 1 and 100' using errcode = '22023';
  end if;

  for v_change in
    select sequence, aggregate_id, operation, revision, changed_at
    from public.sync_changes
    where user_id = v_user_id
      and sequence > p_after_sequence
    order by sequence
    limit p_limit
  loop
    v_aggregate := null;

    if v_change.operation = 'upsert' then
      select jsonb_build_object(
        'schemaVersion', 2,
        'venue', case when v.id is null then null else jsonb_build_object(
          'id', v.id,
          'name', v.name,
          'lastUsedAt', v.last_used_at,
          'createdAt', v.created_at,
          'updatedAt', v.updated_at,
          'deletedAt', v.deleted_at
        ) end,
        'session', jsonb_build_object(
          'id', s.id,
          'venueId', s.venue_id,
          'venueNameSnapshot', s.venue_name_snapshot,
          'startedAt', s.started_at,
          'endedAt', s.ended_at,
          'timezoneName', s.timezone_name,
          'elapsedSeconds', s.elapsed_seconds,
          'heatSeconds', s.heat_seconds,
          'coldSeconds', s.cold_seconds,
          'restSeconds', s.rest_seconds,
          'intervalCount', s.interval_count,
          'rating', s.rating,
          'note', s.note,
          'entryMethod', s.entry_method,
          'revision', s.revision,
          'createdAt', s.created_at,
          'updatedAt', s.updated_at,
          'deletedAt', s.deleted_at
        ),
        'intervals', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', si.id,
              'position', si.position,
              'kind', si.kind,
              'durationSeconds', si.duration_seconds,
              'temperatureCTenths', si.temperature_c_tenths,
              'startedAt', si.started_at,
              'endedAt', si.ended_at,
              'createdAt', si.created_at,
              'updatedAt', si.updated_at
            ) order by si.position
          )
          from public.session_intervals si
          where si.session_id = s.id
            and si.user_id = v_user_id
        ), '[]'::jsonb)
      ) into v_aggregate
      from public.sessions s
      left join public.venues v
        on v.id = s.venue_id and v.user_id = s.user_id
      where s.id = v_change.aggregate_id
        and s.user_id = v_user_id
        and s.deleted_at is null;
    end if;

    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'sequence', v_change.sequence,
      'aggregateId', v_change.aggregate_id,
      'operation', v_change.operation,
      'revision', v_change.revision,
      'changedAt', v_change.changed_at,
      'aggregate', v_aggregate
    ));
    v_next_cursor := v_change.sequence;
  end loop;

  select exists(
    select 1
    from public.sync_changes
    where user_id = v_user_id and sequence > v_next_cursor
  ) into v_has_more;

  return jsonb_build_object(
    'changes', v_changes,
    'nextCursor', v_next_cursor,
    'hasMore', v_has_more
  );
end;
$$;

revoke all on function public.pull_session_changes(bigint, integer)
  from public, anon;
grant execute on function public.pull_session_changes(bigint, integer)
  to authenticated;
