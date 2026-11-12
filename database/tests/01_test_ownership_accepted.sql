begin;

-- Simulate a request from your authenticated account.
set local role authenticated;

select set_config(
    'request.jwt.claims',
    '{"sub":"da8c649a-6832-4e22-9dbf-97a7bba49e40","role":"authenticated"}',
    true
);

-- Create your profile, or update its name if it already exists.
insert into public.user_profiles (display_name)
values ('RLS test')
on conflict (id)
do update set display_name = excluded.display_name;

-- Verify you can update your own profile.
update public.user_profiles
set display_name = 'Updated RLS test'
where id = auth.uid();

-- Verify you can read it.
select
    id = auth.uid() as belongs_to_me,
    display_name
from public.user_profiles;

-- Undo test changes and restore the normal SQL Editor role.
rollback;