begin;

-- Allow only the operations needed for profiles.
revoke all privileges on table public.user_profiles
from anon, authenticated;

grant select, insert, update on table public.user_profiles
to authenticated;

-- Users can read only their own profile.
create policy "Users can view their own profile"
on public.user_profiles
for select
to authenticated
using ((select auth.uid()) = id);

-- Users can create a profile only for themselves.
create policy "Users can create their own profile"
on public.user_profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

-- Users can update their profile, but cannot transfer ownership.
create policy "Users can update their own profile"
on public.user_profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

commit;