begin;

create table public.user_profiles (
  id uuid primary key
    default auth.uid()
    references auth.users(id) on delete cascade,

    display_name text,
    usual_bedtime time without time zone,
    usual_wake_time time without time zone,
    sleep_goal_minutes smallint,
    caffeine_frequency text,
    caffeine_sensitivity text,
    selected_side_effects text[] not null default '{}',
    initial_energy_rating smallint,
    preferences_completed boolean not null default false,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint valid_display_name check (
      display_name is null
      or (
        display_name = btrim(display_name)
        and char_length(display_name) between 1 and 80
      )
    ),

    constraint valid_sleep_goal check (
      sleep_goal_minutes between 1 and 1440
    ),

    constraint valid_caffeine_frequency check (
      caffeine_frequency in ('never', 'occasionally', 'daily')
    ),

    constraint valid_caffeine_sensitivity check (
      caffeine_sensitivity in ('low', 'medium', 'high')
    ),

    constraint valid_side_effects check (
      selected_side_effects <@ array[
        'jitters',
        'anxiety',
        'palpitations',
        'sleep_disruption',
        'stomach_upset'
      ]::text[]
      and array_position(selected_side_effects, null) is null
    ),

    constraint valid_initial_energy check (
      initial_energy_rating between 1 and 10
    ),

    constraint completed_preferences_has_required_data check (
      not preferences_completed
      or (
        display_name is not null
        and usual_bedtime is not null
        and usual_wake_time is not null
        and sleep_goal_minutes is not null
        and caffeine_frequency is not null
        and caffeine_sensitivity is not null
        and initial_energy_rating is not null
      )
    )
);

-- Enable protection immediately.
-- Client access remains blocked until we add policies next.
alter table public.user_profiles enable row level security;

-- Refresh updated_at automatically whenver a profile changes
create function public.set_user_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_user_profile_updated_at();

commit;