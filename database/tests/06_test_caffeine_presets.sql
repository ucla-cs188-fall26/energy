begin;

set local role authenticated;

select
    count(*) = 5 as starter_presets_present,

    not has_table_privilege(
        current_user, 'public.caffeine_presets', 'INSERT'
    ) as insert_blocked,

    not has_table_privilege(
        current_user, 'public.caffeine_presets', 'UPDATE'
    ) as update_blocked,

    not has_table_privilege(
        current_user, 'public.caffeine_presets', 'DELETE'
    ) as delete_blocked

from public.caffeine_presets
where id in (
    'brewed-coffee',
    'espresso-single',
    'espresso-double',
    'black-tea',
    'green-tea'
);

rollback;