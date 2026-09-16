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
          'roundCount', s.round_count,
          'rating', s.rating,
          'note', s.note,
          'entryMethod', s.entry_method,
          'revision', s.revision,
          'createdAt', s.created_at,
          'updatedAt', s.updated_at,
          'deletedAt', s.deleted_at
        ),
        'rounds', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', r.id,
              'position', r.position,
              'createdAt', r.created_at,
              'updatedAt', r.updated_at,
              'parts', coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'id', rp.id,
                    'position', rp.position,
                    'kind', rp.kind,
                    'durationSeconds', rp.duration_seconds,
                    'temperatureCTenths', rp.temperature_c_tenths,
                    'startedAt', rp.started_at,
                    'endedAt', rp.ended_at,
                    'createdAt', rp.created_at,
                    'updatedAt', rp.updated_at
                  ) order by rp.position
                )
                from public.round_parts rp
                where rp.round_id = r.id
                  and rp.session_id = s.id
                  and rp.user_id = v_user_id
              ), '[]'::jsonb)
            ) order by r.position
          )
          from public.rounds r
          where r.session_id = s.id
            and r.user_id = v_user_id
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
