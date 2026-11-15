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
values ('YOUR_USER_UUID'::uuid, 'Unauthorized profile');

rollback;