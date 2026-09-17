-- The auth trigger normally creates this row. Allow an authenticated client to
-- repair only its own missing profile if trigger provisioning was interrupted.
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

grant insert on public.profiles to authenticated;
