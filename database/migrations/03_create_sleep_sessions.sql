begin;

-- 1.) Store sleep sessions and enforce valid values
create table public.sleep_sessions (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        default auth.uid()
        references auth.users(id) on delete cascade,

    started_at timestamptz not null default now(),
    ended_at timestamptz,

    duration_seconds numeric generated always as (
        extract(epoch from (ended_at - started_at))
    ) stored,

    sleep_quality smallint,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint sleep_start_is_finite check (
        isfinite(started_at)
    ),

    constraint sleep_end_is_valid check (
        ended_at is null
        or (
            isfinite(ended_at)
            and ended_at > started_at
        )
    ),

    constraint sleep_quality_is_valid check (
        sleep_quality between 1 and 5
    ),

    constraint sleep_quality_requires_completed_session check (
        sleep_quality is null
        or ended_at is not null
    )   
);

-- 2.) Prevent simultaneous active sleep sessions, including concurrent requests
create unique index sleep_sessions_one_active_per_user
on public.sleep_sessions (user_id)
where ended_at is null;

-- 3.) Support ownership filtering and newest-first history
create index sleep_sessions_user_history
on public.sleep_sessions (user_id, started_at desc, id desc);

-- 4.) Enable row-level protection
alter table public.sleep_sessions enable row level security;

revoke all privileges on table public.sleep_sessions
from anon, authenticated;


grant select on table public.sleep_sessions
to authenticated;

grant insert (
    user_id,
    started_at,
    ended_at,
    sleep_quality
) on public.sleep_sessions
to authenticated;

grant update (
    started_at,
    ended_at,
    sleep_quality
) on public.sleep_sessions
to authenticated;

-- 5.) Users can read only their own sessions
create policy "Users can view their own sleep sessions"
on public.sleep_sessions
for select
to authenticated
using ((select auth.uid()) = user_id);

-- Users can create sessions only for themselves
create policy "Users can create their own sleep sessions"
on public.sleep_sessions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- Users can modify only sessions they own
create policy "Users can update their own sleep sessions"
on public.sleep_sessions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- 6.) Maintain the modification timestamp automatically
create function public.set_sleep_session_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger set_sleep_session_updated_at
before update on public.sleep_sessions
for each row
execute function public.set_sleep_session_updated_at();

commit;
