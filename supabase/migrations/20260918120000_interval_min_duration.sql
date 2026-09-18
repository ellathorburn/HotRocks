-- Entries now last at least 30 seconds; the app shows them in steps of
-- 30 seconds and then whole minutes. Sessions saved during testing with
-- shorter entries are removed first so the new constraint can be added. The
-- matching local migration removes the same sessions on the device.
delete from public.sessions s
where exists (
  select 1
  from public.session_intervals si
  where si.session_id = s.id
    and si.duration_seconds < 30
);

alter table public.session_intervals
  drop constraint session_intervals_duration_seconds_check,
  add constraint session_intervals_min_duration check (duration_seconds >= 30);
