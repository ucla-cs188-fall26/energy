begin;

-- 1.) Store self-reported energy observations
create table public.energy_checkins (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        default auth.uid()
        references auth.users(id) on delete cascade,

    energy_rating smallint not null,
    recorded_at timestamptz not null default now(),
    created_at timestamptz not null default now(),

    constraint energy_rating_valid check (
        energy_rating between 1 and 10
    ),

    constraint energy_recorded_at_valid check (
        isfinite(recorded_at)
    )
);


-- 2. Support ownership filtering and stable history 
create index energy_checkins_user_history
on public.energy_checkins (user_id, recorded_at desc, id desc);

-- 3. Enable ownership protection
alter table public.energy_checkins enable row level security;

revoke all privileges on table public.energy_checkins
from anon, authenticated;

grant select on table public.energy_checkins
to authenticated;

grant insert (
    user_id,
    energy_rating,
    recorded_at
) on public.energy_checkins
to authenticated;

create policy "Users can view their own energy checkins"
on public.energy_checkins
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own energy checkins"
on public.energy_checkins
for insert
to authenticated
with check ((select auth.uid()) = user_id);

commit;