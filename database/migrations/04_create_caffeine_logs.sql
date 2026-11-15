begin;

-- 1.) Store each consumption event
create table public.caffeine_logs (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        default auth.uid()
        references auth.users(id) on delete cascade,

    beverage_name text not null,
    caffeine_mg numeric(10, 2) not null,
    serving_size_ml numeric(10, 2) not null,
    consumed_at timestamptz not null default now(),
    logging_method text not null default 'manual',

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint caffeine_beverage_name_valid check (
        beverage_name = btrim(beverage_name)
        and char_length(beverage_name) between 1 and 150
    ),

    constraint caffeine_amount_valid check (
        caffeine_mg >= 0
        and caffeine_mg < 'Infinity'::numeric
    ),

    constraint caffeine_serving_size check (
        serving_size_ml > 0 
        and serving_size_ml < 'Infinity'::numeric
    ),

    constraint caffeine_consumed_at_valid check (
        isfinite(consumed_at)
    ),

    constraint caffeine_logging_method_valid check (
        logging_method in ('manual', 'preset', 'camera')
    )
);

-- 2.) Support ownership filtering, daily totals, and ordered history
create index caffeine_logs_user_history
on public.caffeine_logs (user_id, consumed_at desc, id desc);

-- 3.) Enable row-level protection
alter table public.caffeine_logs enable row level security;

revoke all privileges on table public.caffeine_logs
from anon, authenticated;


grant select, delete on table public.caffeine_logs
to authenticated;

grant insert (
    user_id,
    beverage_name,
    caffeine_mg,
    serving_size_ml,
    consumed_at,
    logging_method
) on public.caffeine_logs
to authenticated;

grant update (
    beverage_name,
    caffeine_mg,
    serving_size_ml,
    consumed_at,
    logging_method
) on public.caffeine_logs
to authenticated;

-- 4. Users can read only their own logs
create policy "Users can view their own caffeine logs"
on public.caffeine_logs
for select
to authenticated
using ((select auth.uid()) = user_id);

-- Users can create logs only for themselves.
create policy "Users can create their own caffeine logs"
on public.caffeine_logs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- Users can update only their own logs
create policy "Users can update their own caffeine logs"
on public.caffeine_logs
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Users can delete only their own logs
create policy "Users can delete their own caffeine logs"
on public.caffeine_logs
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- 5. Maintain the modification timestamp
create function public.set_caffeine_log_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger caffeine_logs_updated_at
before update on public.caffeine_logs
for each row
execute function public.set_caffeine_log_updated_at();

commit;