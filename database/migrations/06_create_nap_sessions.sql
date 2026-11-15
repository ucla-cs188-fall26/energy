begin;

-- 1.) Store nap sessions
create table public.nap_sessions (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        default auth.uid()
        references auth.users(id) on delete cascade,

    started_at timestamptz not null default now(),
    ended_at timestamptz,

    duration_seconds numeric generated always as (
        extract(epoch from (ended_at - started_at))
    ) stored,

    refreshed_rating smallint,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint nap_start_is_finite check (
        isfinite(started_at)
    ),

    constraint nap_end_is_valid check (
        ended_at is null
        or (
            isfinite(ended_at)
            and ended_at > started_at
        )
    ),

    constraint nap_refreshed_rating_valid check (
        refreshed_rating between 1 and 5
    ),

    constraint nap_rating_requires_completed_session check (
        refreshed_rating is null
        or ended_at is not null
    )
);

-- 2.) Allow only one active nap per user
create unique index nap_sessions_one_active_per_user
on public.nap_sessions (user_id)
where ended_at is null;

-- 3.) Support ownership filtering and ordered history
create index nap_sessions_user_history
on public.nap_sessions (user_id, started_at desc, id desc);

-- 4.) Enable ownership protection
alter table public.nap_sessions enable row level security;

revoke all privileges on table public.nap_sessions
from anon, authenticated;

grant select on table public.nap_sessions
to authenticated;

grant insert (
    user_id,
    started_at,
    ended_at,
    refreshed_rating
) on public.nap_sessions
to authenticated;

grant update (
    started_at,
    ended_at,
    refreshed_rating
) on public.nap_sessions
to authenticated;

create policy "Users can view their own nap sessions"
on public.nap_sessions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own nap sessions"
on public.nap_sessions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own nap sessions"
on public.nap_sessions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- 5.) Maintain the modification timestamp
create function public.set_nap_session_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger nap_sessions_updated_at
before update on public.nap_sessions
for each row
execute function public.set_nap_session_updated_at();

commit;