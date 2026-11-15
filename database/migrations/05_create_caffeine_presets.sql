begin;

-- Shared catelog: authenticated users can read presets
-- Catalog changes are managed administratively
create table public.caffeine_presets (
    id text primary key,
    beverage_name text not null,
    caffeine_mg numeric(10, 2) not null,
    serving_size_ml numeric(10, 2) not null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint caffeine_preset_name_valid check (
        beverage_name = btrim(beverage_name)
        and char_length(beverage_name) between 1 and 150
    ),

    constraint caffeine_preset_amount_valid check (
        caffeine_mg >= 0
        and caffeine_mg < 'Infinity'::numeric
    ),

    constraint caffeine_preset_serving_valid check (
        serving_size_ml > 0
        and serving_size_ml < 'Infinity'::numeric
    )
);

alter table public.caffeine_presets enable row level security;

revoke all privileges on table public.caffeine_presets
from anon, authenticated;

grant select on table public.caffeine_presets
to authenticated;

create policy "Authenticated users can read caffeine presets"
on public.caffeine_presets
for select
to authenticated
using (true);

create function public.set_caffeine_preset_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger caffeine_presets_updated_at
before update on public.caffeine_presets
for each row
execute function public.set_caffeine_preset_updated_at();

-- Caffeine amounts are estimates per listed serving
insert into public.caffeine_presets (
    id,
    beverage_name,
    caffeine_mg,
    serving_size_ml
)
values
    ('brewed-coffee', 'Brewed coffee', 95, 237),
    ('espresso-single', 'Espresso — single shot', 63, 30),
    ('espresso-double', 'Espresso — double shot', 126, 60),
    ('black-tea', 'Black tea', 47, 237),
    ('green-tea', 'Green tea', 28, 237);

commit;