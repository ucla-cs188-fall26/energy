from datetime import datetime, timedelta, timezone
from math import exp
from zoneinfo import ZoneInfo

import pytest

from energy_api.schemas.prediction import PredictionParameters
from energy_api.services.prediction.formulas import (
    Dose, Interval, caffeine, circadian, combine_score, merge_intervals,
    predict, pressure_after, reference_pressure, sleep_inertia, sleep_recovery,
)

P = PredictionParameters()
UTC = timezone.utc
DAY = datetime(2026, 11, 15, tzinfo=UTC)


def night(hours=8):
    end = DAY + timedelta(hours=7)
    return Interval(end - timedelta(hours=hours), end)


def run(now=None, sleep=None, naps=None, doses=None, **kwargs):
    return predict(now=now or DAY + timedelta(hours=15), zone=ZoneInfo('UTC'),
        sleep=[night()] if sleep is None else sleep, naps=naps or [], doses=doses or [],
        params=P, active=False, **kwargs)


def test_homeostatic_equations_and_reference():
    assert pressure_after(0.2, 18.2, False, P) == pytest.approx(1 - 0.8 / exp(1))
    assert pressure_after(0.8, 4.2, True, P) == pytest.approx(0.8 / exp(1))
    ref = reference_pressure(P)
    assert pressure_after(pressure_after(ref, 16, False, P), 8, True, P) == pytest.approx(ref)
    assert sleep_recovery(ref, P) == 1


@pytest.mark.parametrize('hours', [0, 1, 8, 24, 100])
def test_pressure_bounded(hours):
    assert 0 <= pressure_after(0.2, hours, False, P) <= 1
    assert 0 <= pressure_after(0.8, hours, True, P) <= 1


def test_pressure_monotonicity():
    assert pressure_after(.4, 2, False, P) > pressure_after(.4, 1, False, P)
    assert pressure_after(.4, 2, True, P) < pressure_after(.4, 1, True, P)
    with pytest.raises(ValueError):
        pressure_after(.2, -1, False, P)


def test_caffeine_half_life_multiple_doses_and_future():
    now = DAY + timedelta(hours=12)
    doses = [Dose(now - timedelta(hours=5), 100), Dose(now - timedelta(hours=10), 100), Dose(now + timedelta(hours=1), 999)]
    assert caffeine(doses, now, P)[0] == pytest.approx(75)
    assert caffeine([], now, P) == (0, 0)


def test_caffeine_onset_delays_effect_not_remaining_amount():
    dose = Dose(DAY, 100)
    assert caffeine([dose], DAY, P) == (100, 0)
    assert caffeine([dose], DAY + timedelta(minutes=30), P)[1] > 0
    late = [caffeine([dose], DAY + timedelta(hours=h), P) for h in (5, 10, 15)]
    assert late[0][0] > late[1][0] > late[2][0]
    assert late[0][1] > late[1][1] > late[2][1]
    with pytest.raises(ValueError):
        caffeine([Dose(DAY, float('nan'))], DAY, P)


def test_circadian_period_and_inertia_decay():
    assert circadian(16, 7, P) == pytest.approx(1)
    assert circadian(4, 7, P) == pytest.approx(-1)
    assert circadian(40, 7, P) == pytest.approx(circadian(16, 7, P))
    assert sleep_inertia(8, 0, P) > sleep_inertia(8, 1, P) > sleep_inertia(8, 3, P)
    assert sleep_inertia(0, 0, P) == 0


def test_combination_bounds_and_caffeine_cannot_erase_all_deficit():
    assert combine_score(0, -1, .1, 0, P) == 0
    assert combine_score(1, 1, 0, 100, P) == 100
    assert combine_score(.1, 0, 0, 1e9, P) < 40


def test_24_hour_scenarios_four_vs_eight_hours():
    for hour in range(8, 24):
        short = run(now=DAY + timedelta(hours=hour), sleep=[night(4)])
        rested = run(now=DAY + timedelta(hours=hour), sleep=[night(8)])
        assert short.score is not None and rested.score is not None
        assert short.score < rested.score
        assert 0 <= short.score <= 100


def test_personal_goals_never_change_physiological_reference():
    scores = [run(personal_goal=g).score for g in (None, 240, 480, 600)]
    assert len(set(scores)) == 1
    assert run(personal_goal=None).physiological_reference_sleep_hours == 8


def test_multiple_coffees_and_nap_scenario():
    now = DAY + timedelta(hours=16)
    base = run(now=now, sleep=[night(4)])
    nap = Interval(DAY + timedelta(hours=14), DAY + timedelta(hours=14, minutes=20))
    refreshed = run(now=now, sleep=[night(4)], naps=[nap])
    coffee = run(now=now, sleep=[night(4)], doses=[Dose(DAY + timedelta(hours=9), 95), Dose(DAY + timedelta(hours=13), 95)])
    assert refreshed.score is not None and base.score is not None and coffee.score is not None
    assert refreshed.score > base.score
    assert coffee.score > base.score
    assert coffee.caffeine_remaining_mg == pytest.approx(round(95 * .5 ** (7 / 5) + 95 * .5 ** (3 / 5), 2))


def test_overlap_is_counted_once():
    sleep = night()
    overlap = Interval(sleep.start + timedelta(hours=1), sleep.end)
    assert merge_intervals([sleep, overlap]) == [sleep]
    assert run(naps=[overlap]).score == run().score


def test_missing_and_stale_history_are_unavailable():
    assert run(sleep=[]).score is None
    assert run(sleep=[]).status == 'unavailable'
    assert run(sleep=[], naps=[Interval(DAY, DAY + timedelta(minutes=20))]).score is None
    old = Interval(DAY - timedelta(days=2), DAY - timedelta(days=1))
    assert run(sleep=[old]).score is None


def test_unknown_gap_resets_instead_of_assuming_days_awake():
    old = Interval(night().start - timedelta(days=3), night().end - timedelta(days=3))
    result = run(sleep=[old, night()])
    assert result.score == run().score
    assert any('Long unknown history gap' in warning for warning in result.warnings)


def test_active_sleep_is_unavailable_until_stopped():
    result = predict(now=DAY + timedelta(hours=15), zone=ZoneInfo('UTC'), sleep=[night()], naps=[],
                     doses=[], params=P, active=True)
    assert result.status == 'sleeping' and result.score is None
    assert all(point.score is None for point in result.forecast)


def test_future_records_do_not_leak_into_prediction():
    future = Interval(DAY + timedelta(days=1), DAY + timedelta(days=1, hours=8))
    assert run(sleep=[night(), future]).score == run().score


@pytest.mark.parametrize('now', [datetime(2026, 11, 1, 7, 30, tzinfo=UTC), datetime(2026, 3, 8, 8, 30, tzinfo=UTC)])
def test_dst_forecast_stays_in_local_day_without_duplicate_instants(now):
    zone = ZoneInfo('America/Los_Angeles')
    result = predict(now=now, zone=zone, sleep=[Interval(now - timedelta(hours=9), now - timedelta(hours=1))],
        naps=[], doses=[], params=P, active=False)
    stamps = [p.timestamp for p in result.forecast]
    assert all(t.date() == now.astimezone(zone).date() for t in stamps)
    assert all((b.astimezone(UTC) - a.astimezone(UTC)).total_seconds() == 3600 for a, b in zip(stamps, stamps[1:]))


def test_invalid_configuration_and_naive_intervals():
    with pytest.raises(ValueError):
        PredictionParameters(caffeine_half_life_hours=0)
    with pytest.raises(ValueError):
        merge_intervals([Interval(datetime(2026, 1, 1), DAY)])


def test_forecast_aligns_to_local_hours_in_fractional_offset_zone():
    result = predict(now=DAY + timedelta(hours=15), zone=ZoneInfo('Asia/Kolkata'),
        sleep=[night()], naps=[], doses=[], params=P, active=False)
    assert result.forecast[0].timestamp.hour == 21
    assert all(point.timestamp.minute == 0 for point in result.forecast)
