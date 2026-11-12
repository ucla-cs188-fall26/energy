begin;

do $$
declare
    test_user_id uuid := 'da8c649a-6832-4e22-9dbf-97a7bba49e40';
begin
    -- Prepare an incomplete profile for testing.
    insert into public.user_profiles (id)
    values (test_user_id)
    on conflict (id) do nothing;

    update public.user_profiles
    set preferences_completed = false,
        usual_bedtime = null
    where id = test_user_id;

    -- Test 1: energy must be between 1 and 10.
    begin
        update public.user_profiles
        set initial_energy_rating = 11
        where id = test_user_id;

        raise exception 'FAIL: invalid energy rating was accepted';
    exception
        when check_violation then
            raise notice 'PASS: invalid energy rating rejected';
    end;

    -- Test 2: sleep goal must be between 1 and 1440 minutes.
    begin
        update public.user_profiles
        set sleep_goal_minutes = 0
        where id = test_user_id;

        raise exception 'FAIL: invalid sleep goal was accepted';
    exception
        when check_violation then
            raise notice 'PASS: invalid sleep goal rejected';
    end;

    -- Test 3: missing bedtime prevents preferences completion.
    begin
        update public.user_profiles
        set preferences_completed = true
        where id = test_user_id;

        raise exception 'FAIL: incomplete preferences was accepted';
    exception
        when check_violation then
            raise notice 'PASS: incomplete preferences rejected';
    end;
end;
$$;

rollback;