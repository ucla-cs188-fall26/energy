from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from energy_api.schemas.prediction import MIN_MAIN_SLEEP_MINUTES, PredictionParameters
from energy_api.services.prediction.formulas import Interval, predict

NOW = datetime(2026, 11, 17, 16, tzinfo=timezone.utc)
NIGHT = Interval(NOW - timedelta(hours=17), NOW - timedelta(hours=9))
SHORT = Interval(NOW - timedelta(minutes=1), NOW)


def run(sleep, naps=(), params=None):
    return predict(now=NOW, zone=ZoneInfo('UTC'), sleep=sleep, naps=list(naps), doses=[], active=False,
                   params=params or PredictionParameters(), wake_hour=7)


def test_one_minute_main_sleep_cannot_anchor_or_recover_prediction():
    result = run([SHORT])
    assert MIN_MAIN_SLEEP_MINUTES == result.parameters.min_main_sleep_minutes == 30
    assert result.score is None and result.status == result.data_quality == 'unavailable'
    assert all(point.score is None for point in result.forecast)
    assert any('Excluded 1 main sleep' in warning for warning in result.warnings)
    assert any('No sufficiently recent recorded main sleep' in warning for warning in result.warnings)


@pytest.mark.parametrize('seconds,qualifies', [(60, False), (1799, False), (1800, True), (1801, True)])
def test_minimum_is_inclusive(seconds, qualifies):
    result = run([Interval(NOW - timedelta(seconds=seconds), NOW)])
    assert (result.score is not None) == qualifies


def test_later_short_sleep_has_no_effect_on_reference_recovery_inertia_or_forecast():
    original = run([NIGHT])
    result = run([NIGHT, SHORT])
    assert result.score == original.score
    assert result.forecast == original.forecast
    assert result.status == 'estimated'
    assert any('Excluded 1' in warning for warning in result.warnings)


def test_short_records_are_not_merged_into_a_qualifying_main_sleep():
    first = Interval(NOW - timedelta(minutes=40), NOW - timedelta(minutes=20))
    second = Interval(NOW - timedelta(minutes=20), NOW)
    assert run([first, second]).score is None


def test_short_sleep_does_not_make_stale_history_recent():
    old = Interval(NIGHT.start - timedelta(days=2), NIGHT.end - timedelta(days=2))
    assert run([old, SHORT]).score is None


def test_threshold_is_configurable():
    thirty = Interval(NOW - timedelta(minutes=30), NOW)
    assert run([thirty], params=PredictionParameters(min_main_sleep_minutes=60)).score is None
    assert run([SHORT], params=PredictionParameters(min_main_sleep_minutes=1)).score is not None


def test_short_naps_still_contribute_pressure_recovery_and_inertia():
    main = Interval(NOW - timedelta(hours=13), NOW - timedelta(hours=9))
    nap = Interval(NOW - timedelta(hours=2), NOW - timedelta(hours=2) + timedelta(minutes=20))
    assert run([main], [nap]).score > run([main]).score
    assert run([SHORT], [nap]).score is None
