-- Every account has a first name and surname. They are nullable at the
-- database level so existing accounts and OAuth sign-ups without a name remain
-- valid; the app asks for a missing name before anything else.
alter table public.profiles
  add column first_name text
    check (first_name is null or char_length(trim(first_name)) between 1 and 80),
  add column last_name text
    check (last_name is null or char_length(trim(last_name)) between 1 and 80);

-- Seeds the profile name from sign-up metadata. Email sign-up sends
-- first_name/last_name; Google sends given_name/family_name. The values only
-- label the user's own profile and are never used for authorization.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first text := nullif(left(trim(coalesce(
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'given_name'
  )), 80), '');
  v_last text := nullif(left(trim(coalesce(
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'family_name'
  )), 80), '');
begin
  insert into public.profiles (user_id, first_name, last_name)
  values (new.id, v_first, v_last)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Ask PostgREST to refresh its schema cache immediately after deployment.
notify pgrst, 'reload schema';
