begin;

select plan(5);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_user_meta_data
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '70000000-0000-0000-0000-000000000007',
    'authenticated', 'authenticated', 'ella@example.com', '', now(), now(), now(),
    '{"first_name": "  Ella ", "last_name": "Thorburn"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '80000000-0000-0000-0000-000000000008',
    'authenticated', 'authenticated', 'google@example.com', '', now(), now(), now(),
    '{"given_name": "Sam", "family_name": "Lee"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '90000000-0000-0000-0000-000000000009',
    'authenticated', 'authenticated', 'noname@example.com', '', now(), now(), now(),
    '{}'::jsonb
  );

select is(
  (select first_name || ' ' || last_name from public.profiles
   where user_id = '70000000-0000-0000-0000-000000000007'),
  'Ella Thorburn',
  'email sign-up metadata seeds a trimmed first name and surname'
);

select is(
  (select first_name || ' ' || last_name from public.profiles
   where user_id = '80000000-0000-0000-0000-000000000008'),
  'Sam Lee',
  'Google given and family names seed the profile'
);

select ok(
  (select first_name is null and last_name is null from public.profiles
   where user_id = '90000000-0000-0000-0000-000000000009'),
  'an account without a name still gets a profile'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-0000-0000-000000000009","role":"authenticated"}',
  true
);

update public.profiles set first_name = 'Robin', last_name = 'Park'
where user_id = '90000000-0000-0000-0000-000000000009';

select is(
  (select first_name from public.profiles where user_id = '90000000-0000-0000-0000-000000000009'),
  'Robin',
  'a user can set their own name'
);

select throws_ok(
  $$ update public.profiles set first_name = '   '
     where user_id = '90000000-0000-0000-0000-000000000009' $$,
  '23514',
  null,
  'a blank name is rejected'
);

select * from finish();
rollback;
