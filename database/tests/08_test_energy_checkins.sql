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
    test_checkin_id uuid;
begin
    insert into public.energy_checkins (energy_rating)
    values (7)
    returning id into test_checkin_id;

    if not exists (
        select 1 from public.energy_checkins
        where id = test_checkin_id and energy_rating = 7
          and recorded_at is not null and created_at is not null
    ) then
        raise exception 'FAIL: own check-in could not be created/read';
    end if;

    begin
        insert into public.energy_checkins (energy_rating) values (11);
        raise exception 'FAIL: invalid energy rating was accepted';
    exception
        when check_violation then null;
    end;

    if has_table_privilege(current_user, 'public.energy_checkins', 'UPDATE')
        or has_table_privilege(current_user, 'public.energy_checkins', 'DELETE')
    then
        raise exception 'FAIL: energy check-ins are not append-only';
    end if;

    perform set_config(
        'request.jwt.claims',
        json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text,
        true
    );

    if exists (
        select 1 from public.energy_checkins where id = test_checkin_id
    ) then
        raise exception 'FAIL: another user could read the check-in';
    end if;

    begin
        insert into public.energy_checkins (user_id, energy_rating)
        values (owner_id, 7);
        raise exception 'FAIL: forged check-in ownership was accepted';
    exception
        when insufficient_privilege then null;
    end;
end;
$$;

select 'PASS: energy ratings, timestamps, ownership, and append-only access' as result;

rollback;
