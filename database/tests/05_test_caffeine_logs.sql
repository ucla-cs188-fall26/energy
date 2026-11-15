begin;

set local role authenticated;

select set_config(
    'request.jwt.claims',
    '{"sub":"YOUR_USER_UUID","role":"authenticated"}',
    true
);

do $$
declare
    owner_id uuid := auth.uid();
    test_log_id uuid;
begin
    insert into public.caffeine_logs (
        beverage_name, caffeine_mg, serving_size_ml
    )
    values ('Test coffee', 95, 237)
    returning id into test_log_id;

    update public.caffeine_logs
    set caffeine_mg = 80
    where id = test_log_id;

    if not exists (
        select 1 from public.caffeine_logs
        where id = test_log_id and caffeine_mg = 80
    ) then
        raise exception 'FAIL: own log could not be updated/read';
    end if;

    -- Simulate another user.
    perform set_config(
        'request.jwt.claims',
        json_build_object(
            'sub', gen_random_uuid(), 'role', 'authenticated'
        )::text,
        true
    );

    if exists (
        select 1 from public.caffeine_logs where id = test_log_id
    ) then
        raise exception 'FAIL: another user could read the log';
    end if;

    update public.caffeine_logs
    set caffeine_mg = 0 where id = test_log_id;

    if found then
        raise exception 'FAIL: another user could update the log';
    end if;

    delete from public.caffeine_logs where id = test_log_id;

    if found then
        raise exception 'FAIL: another user could delete the log';
    end if;

    -- Restore the owner and verify deletion.
    perform set_config(
        'request.jwt.claims',
        json_build_object(
            'sub', owner_id, 'role', 'authenticated'
        )::text,
        true
    );

    delete from public.caffeine_logs where id = test_log_id;

    if not found then
        raise exception 'FAIL: owner could not delete the log';
    end if;
end;
$$;

select 'PASS: own CRUD and user isolation' as result;

rollback;