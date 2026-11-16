-- Align user_profiles with the preference screens (EnergySync preference design):
--   * caffeine frequency has four options instead of three
--   * side effects match the six choices shown in Step 2
--   * Step 4 collects sex, age, weight, height and preferred units
--   * every preference step can be skipped, and no screen asks for an initial
--     energy rating, so completion no longer requires one
begin;

-- Caffeine frequency: never / occasionally / daily
--   -> daily / few_times_week / rarely / never
alter table public.user_profiles drop constraint valid_caffeine_frequency;

update public.user_profiles
set caffeine_frequency = 'few_times_week'
where caffeine_frequency = 'occasionally';

alter table public.user_profiles add constraint valid_caffeine_frequency check (
  caffeine_frequency in ('daily', 'few_times_week', 'rarely', 'never')
);

-- Side effects: drop palpitations, add headaches and energy_crash.
alter table public.user_profiles drop constraint valid_side_effects;

update public.user_profiles
set selected_side_effects = array_remove(selected_side_effects, 'palpitations')
where 'palpitations' = any(selected_side_effects);

alter table public.user_profiles add constraint valid_side_effects check (
  selected_side_effects <@ array[
    'jitters',
    'anxiety',
    'headaches',
    'sleep_disruption',
    'stomach_upset',
    'energy_crash'
  ]::text[]
  and array_position(selected_side_effects, null) is null
);

-- Body details from Step 4. All optional; measurements are stored metric.
alter table public.user_profiles
  add column sex text,
  add column age_years smallint,
  add column weight_kg numeric(4, 1),
  add column height_cm numeric(4, 1),
  add column measurement_units text not null default 'metric',
  add constraint valid_sex check (sex in ('female', 'male')),
  add constraint valid_age check (age_years between 13 and 120),
  add constraint valid_weight check (weight_kg between 20 and 400),
  add constraint valid_height check (height_cm between 50 and 272),
  add constraint valid_measurement_units check (measurement_units in ('metric', 'imperial'));

-- Completion no longer requires initial_energy_rating.
alter table public.user_profiles drop constraint completed_preferences_has_required_data;

alter table public.user_profiles add constraint completed_preferences_has_required_data check (
  not preferences_completed
  or (
    display_name is not null
    and usual_bedtime is not null
    and usual_wake_time is not null
    and sleep_goal_minutes is not null
    and caffeine_frequency is not null
    and caffeine_sensitivity is not null
  )
);

commit;
