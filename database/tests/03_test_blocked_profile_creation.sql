begin;

set local role authenticated;

select set_config(
    'request.jwt.claims',
    json_build_object(
        'sub', gen_random_uuid()::text,
        'role', 'authenticated'
    )::text,
    true
);

-- Attempt to create a profile owned by your actual account.
insert into public.user_profiles (id, display_name)
values ('da8c649a-6832-4e22-9dbf-97a7bba49e40'::uuid, 'Unauthorized profile');

rollback;