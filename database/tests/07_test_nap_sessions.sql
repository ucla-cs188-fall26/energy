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
    test_nap_id uuid;
    active_nap_id uuid;
begin
    -- A completed nap crossing midnight should last 20 minutes.
    insert into public.nap_sessions (started_at, ended_at)
    values ('2026-11-14 23:50:00+00', '2026-11-15 00:10:00+00')
    returning id into test_nap_id;

    update public.nap_sessions
    set refreshed_rating = 5 where id = test_nap_id;

    if not exists (
        select 1 from public.nap_sessions
        where id = test_nap_id
          and duration_seconds = 1200 and refreshed_rating = 5
    ) then
        raise exception 'FAIL: own nap duration or rating is incorrect';
    end if;

    -- Prepare an active nap only if the user has none already.
    if not exists (
        select 1 from public.nap_sessions where ended_at is null
    ) then
        insert into public.nap_sessions (started_at)
        values (now() - interval '20 minutes')
        returning id into active_nap_id;
    end if;

    begin
        insert into public.nap_sessions (started_at) values (now());
        raise exception 'FAIL: multiple active naps were allowed';
    exception
        when unique_violation then null;
    end;

    -- Stop only the active nap created by this test.
    if active_nap_id is not null then
        update public.nap_sessions
        set ended_at = started_at + interval '20 minutes'
        where id = active_nap_id;
    end if;

    begin
        update public.nap_sessions
        set refreshed_rating = 6 where id = test_nap_id;
        raise exception 'FAIL: invalid rating was accepted';
    exception
        when check_violation then null;
    end;

    -- Another identity must not see or update the owner's nap.
    perform set_config(
        'request.jwt.claims',
        json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text,
        true
    );

    if exists (select 1 from public.nap_sessions where id = test_nap_id) then
        raise exception 'FAIL: another user could read the nap';
    end if;

    update public.nap_sessions set refreshed_rating = 1 where id = test_nap_id;
    if found then
        raise exception 'FAIL: another user could update the nap';
    end if;

    begin
        insert into public.nap_sessions (user_id, started_at, ended_at)
        values (owner_id, now() - interval '20 minutes', now());
        raise exception 'FAIL: forged nap ownership was accepted';
    exception
        when insufficient_privilege then null;
    end;
end;
$$;

select 'PASS: nap duration, ratings, active limit, and ownership' as result;

rollback;
