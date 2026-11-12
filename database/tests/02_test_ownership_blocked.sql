begin;

insert into public.user_profiles (id, display_name)
values ('da8c649a-6832-4e22-9dbf-97a7bba49e40'::uuid, 'Ownership test')
on conflict (id) do nothing;

set local role authenticated;

select set_config(
    'request.jwt.claims',
    json_build_object(
        'sub', gen_random_uuid()::text,
        'role', 'authenticated'
    )::text,
    true
);

with changed as (
    update public.user_profiles
    set display_name = 'Unauthorized change'
    where id = 'da8c649a-6832-4e22-9dbf-97a7bba49e40'::uuid
    returning id
)
select
    (
        select count(*)
        from public.user_profiles
        where id = 'da8c649a-6832-4e22-9dbf-97a7bba49e40'::uuid
    ) as visible_profiles,
    (select count(*) from changed) as updated_profiles;

rollback;