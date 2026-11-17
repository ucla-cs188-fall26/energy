"""Controlled simulations of the existing formula; no database or wall clock.

From backend/: .venv/bin/python -m tests.test_prediction_scenarios
prints the same scenarios validated by pytest.
"""
import json
from datetime import datetime, timedelta
from math import exp
from zoneinfo import ZoneInfo

import pytest

from energy_api.schemas.prediction import PredictionParameters
from energy_api.services.prediction.formulas import (
    Dose, Interval, caffeine, circadian, combine_score, merge_intervals,
    predict, pressure_at, sleep_inertia, sleep_recovery,
)

ZONE = ZoneInfo('America/Los_Angeles')
DAY = datetime(2026, 11, 17, tzinfo=ZONE)
PARAMS = PredictionParameters()


def at(hour):
    return DAY + timedelta(hours=hour)


def night(hours=8):
    return Interval(at(7 - hours), at(7))


NAP = Interval(at(14), at(14 + 1/3))
COFFEE = Dose(at(9), 100)


def estimate(hour, *, hours=8, sleep=None, naps=(), doses=(), wake_hour=7):
    main = [night(hours)] if sleep is None else sleep
    now = at(hour)
    active = any(i.start <= now < i.end for i in [*main, *naps])
    return predict(now=now, zone=ZONE, sleep=main, naps=list(naps), doses=list(doses),
                   active=active, params=PARAMS, wake_hour=wake_hour, personal_goal=None)


def components(hour, *, hours=4, naps=(), doses=()):
    now = at(hour)
    intervals = merge_intervals([night(hours), *[i for i in naps if i.end <= now]])
    pressure, _ = pressure_at(intervals, now, PARAMS)
    last = intervals[-1]
    inertia = sleep_inertia((last.end - last.start).total_seconds()/3600,
                           (now - last.end).total_seconds()/3600, PARAMS)
    remaining, effective = caffeine(list(doses), now, PARAMS)
    rhythm = circadian(hour % 24, 7, PARAMS)
    recovery = sleep_recovery(pressure, PARAMS)
    score = combine_score(recovery, rhythm, inertia, effective, PARAMS)
    penalty = combine_score(recovery, rhythm, 0, effective, PARAMS) - score
    return dict(pressure=pressure, inertia_penalty_points=penalty,
                remaining_mg=remaining, effective_mg=effective, unrounded_score=score)


def smoothness(hours, naps=(), doses=()):
    previous = None
    scores, changes = [], []
    unavailable = sleeping = 0
    for minute in range(1440):
        result = estimate(minute/60, hours=hours, naps=naps, doses=doses)
        if result.score is None:
            unavailable += result.status == 'unavailable'
            sleeping += result.status == 'sleeping'
        else:
            scores.append(result.score)
            if previous is not None:
                changes.append(abs(result.score - previous))
        previous = result.score
    return dict(min_score=min(scores) if scores else None, max_score=max(scores) if scores else None,
                max_change_per_minute=round(max(changes, default=0), 3), estimated_minutes=len(scores),
                unavailable_minutes=unavailable, sleeping_minutes=sleeping)


def scenario_report():
    sleep = [dict(time=at(h).strftime('%H:%M'), one_minute=estimate(h, hours=1/60).score,
                  eight_hours=estimate(h).score) for h in (7, 8, 10, 12, 16, 20, 23)]
    coffee = []
    for age in (0, .25, .5, 1, 1.5, 2, 5, 10):
        values = components(9 + age, doses=[COFFEE])
        coffee.append(dict(hours_after_dose=age, remaining_mg=round(values['remaining_mg'], 2),
                           effective_mg=round(values['effective_mg'], 2),
                           without_caffeine=estimate(9 + age, hours=4).score,
                           with_caffeine=estimate(9 + age, hours=4, doses=[COFFEE]).score))
    nap = []
    for minutes in (0, 10, 30, 60, 120):
        hour = 14 + 1/3 + minutes/60
        before, after = components(hour), components(hour, naps=[NAP])
        nap.append(dict(time=at(hour).strftime('%H:%M'), minutes_after_nap=minutes,
                        without_nap=estimate(hour, hours=4).score,
                        with_nap=estimate(hour, hours=4, naps=[NAP]).score,
                        pressure_without=round(before['pressure'], 5),
                        pressure_with=round(after['pressure'], 5),
                        nap_inertia_penalty_points=round(after['inertia_penalty_points'], 3)))
    old = Interval(night().start - timedelta(days=3), night().end - timedelta(days=3))
    cases = dict(no_sleep=estimate(12, sleep=[]),
                 no_sleep_with_caffeine=estimate(12, sleep=[], doses=[COFFEE]),
                 nap_only=estimate(16, sleep=[], naps=[NAP]),
                 stale_sleep=estimate(12, sleep=[old]),
                 missing_wake_preference=estimate(12, wake_hour=None),
                 long_unknown_gap_then_recent_sleep=estimate(12, sleep=[old, night()]))
    fallback = {key: dict(score=value.score, status=value.status, data_quality=value.data_quality,
                         caffeine_remaining_mg=value.caffeine_remaining_mg, warnings=value.warnings)
                for key, value in cases.items()}
    scans = {name: smoothness(**args) for name, args in {
        'one_minute_sleep': dict(hours=1/60), 'eight_hours_sleep': dict(hours=8),
        'four_hours_plus_coffee': dict(hours=4, doses=[COFFEE]),
        'four_hours_plus_nap': dict(hours=4, naps=[NAP]),
    }.items()}
    return dict(date=DAY.date().isoformat(), timezone=ZONE.key, parameters=PARAMS.model_dump(),
                sleep=sleep, caffeine=coffee, nap=nap, fallbacks=fallback, minute_scans=scans)


@pytest.mark.parametrize('hour', [7, 8, 10, 12, 16, 20, 23])
def test_one_minute_vs_eight_hours(hour):
    short, full = estimate(hour, hours=1/60), estimate(hour)
    assert short.score is None and full.score is not None
    assert short.status == short.data_quality == 'unavailable'
    assert full.data_quality == 'limited'
    assert any('shorter than 30 minutes' in warning for warning in short.warnings)
    assert any('initial-state uncertainty' in warning for warning in short.warnings)
    assert full.physiological_reference_sleep_hours == 8
    assert short.personal_sleep_goal_minutes is None


def test_100mg_onset_elimination_and_scores():
    values = [components(9 + age, doses=[COFFEE]) for age in (0, .25, .5, 1, 2, 5, 10)]
    assert values[0]['remaining_mg'] == 100 and values[0]['effective_mg'] == 0
    assert values[5]['remaining_mg'] == pytest.approx(50)
    assert values[6]['remaining_mg'] == pytest.approx(25)
    assert all(b['remaining_mg'] < a['remaining_mg'] for a, b in zip(values, values[1:]))
    assert values[0]['effective_mg'] < values[1]['effective_mg'] < values[2]['effective_mg'] < values[3]['effective_mg']
    assert values[4]['effective_mg'] > values[5]['effective_mg'] > values[6]['effective_mg']
    assert estimate(9, hours=4, doses=[COFFEE]).score == estimate(9, hours=4).score
    for hour in (9.25, 9.5, 10, 11, 14, 19):
        assert estimate(hour, hours=4, doses=[COFFEE]).score > estimate(hour, hours=4).score


def test_twenty_minute_nap_pressure_and_inertia():
    hour = 14 + 1/3
    after = components(hour, naps=[NAP])
    assert after['pressure'] == pytest.approx(components(14)['pressure'] * exp(-(1/3)/PARAMS.sleep_tau_hours))
    assert after['pressure'] < components(hour)['pressure']
    penalties = [components(hour + offset, naps=[NAP])['inertia_penalty_points'] for offset in (0, 1/6, .5, 1, 2)]
    assert all(a > b > 0 for a, b in zip(penalties, penalties[1:]))
    for offset in (0, 1/6, .5, 1, 2):
        assert estimate(hour + offset, hours=4, naps=[NAP]).score > estimate(hour + offset, hours=4).score
    active = estimate(14 + 1/6, hours=4, naps=[NAP])
    assert active.status == 'sleeping' and active.score is None


@pytest.mark.parametrize('kind', ['no_sleep', 'nap_only', 'stale'])
def test_missing_history_even_with_caffeine(kind):
    old = Interval(night().start - timedelta(days=3), night().end - timedelta(days=3))
    result = estimate(16, sleep=[old] if kind == 'stale' else [],
                      naps=[NAP] if kind == 'nap_only' else [], doses=[COFFEE])
    assert result.score is None and result.status == result.data_quality == 'unavailable'
    assert result.caffeine_remaining_mg > 0
    assert all(point.score is None for point in result.forecast)
    assert any('No sufficiently recent recorded main sleep' in warning for warning in result.warnings)


def test_preference_and_unknown_gap_fallbacks():
    implicit = estimate(12, wake_hour=None)
    assert implicit.score == estimate(12, wake_hour=7).score
    assert any('07:00 local fallback' in warning for warning in implicit.warnings)
    old = Interval(night().start - timedelta(days=3), night().end - timedelta(days=3))
    result = estimate(12, sleep=[old, night()])
    assert result.score == estimate(12).score
    assert any('prior pressure was reset' in warning for warning in result.warnings)


@pytest.mark.parametrize('hours,naps,doses', [(1/60, [], []), (8, [], []), (4, [], [COFFEE]), (4, [NAP], [])])
def test_full_day_bounds_and_smoothness(hours, naps, doses):
    values = smoothness(hours, naps, doses)
    if values['estimated_minutes']:
        assert 0 <= values['min_score'] <= values['max_score'] <= 100
    else:
        assert values['min_score'] is None and values['max_score'] is None
    # Guard these default-parameter scenarios against abrupt numerical jumps;
    # not a universal or clinically established alertness-change threshold.
    assert values['max_change_per_minute'] < 1
    assert sum(values[key] for key in ('estimated_minutes', 'unavailable_minutes', 'sleeping_minutes')) == 1440


if __name__ == '__main__':
    print(json.dumps(scenario_report(), indent=2))
