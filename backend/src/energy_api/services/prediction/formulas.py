"""Pure research-informed relationships; the resulting score is not validated.

Process S: published 18.2h wake / 4.2h sleep time constants.
Inertia: 0.67h subjective-alertness decay (Jewett et al., 1999).
Circadian phase, onset, amplitudes, Hill scaling, and 0–100 mapping are heuristics.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from math import cos, exp, isfinite, pi
from zoneinfo import ZoneInfo

from energy_api.schemas.prediction import EnergyPrediction, PredictionParameters, PredictionPoint

UTC = timezone.utc


def utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError('Timezone-aware timestamps are required')
    return value.astimezone(UTC)


def clip(value: float) -> float:
    return max(0.0, min(1.0, value))


def pressure_after(pressure: float, hours: float, asleep: bool, params: PredictionParameters) -> float:
    if not isfinite(pressure) or not isfinite(hours) or hours < 0 or not 0 <= pressure <= 1:
        raise ValueError('Invalid pressure or duration')
    return pressure * exp(-hours / params.sleep_tau_hours) if asleep else 1 - (1 - pressure) * exp(-hours / params.wake_tau_hours)


def reference_pressure(params: PredictionParameters) -> float:
    # Fixed eight-hour physiological reference; personal goals never alter this.
    a, b = exp(-16 / params.wake_tau_hours), exp(-8 / params.sleep_tau_hours)
    return b * (1 - a) / (1 - a * b)


def sleep_recovery(pressure: float, params: PredictionParameters) -> float:
    return clip((1 - pressure) / (1 - reference_pressure(params)))


def circadian(hour: float, wake_hour: float, params: PredictionParameters) -> float:
    return cos(2 * pi * (hour - (wake_hour + params.circadian_peak_after_wake_hours)) / 24)


def sleep_inertia(duration_hours: float, since_wake_hours: float, params: PredictionParameters) -> float:
    if duration_hours < 0 or since_wake_hours < 0:
        raise ValueError('Invalid sleep inertia times')
    return params.inertia_amplitude * (1 - exp(-duration_hours / params.sleep_tau_hours)) * exp(-since_wake_hours / params.inertia_tau_hours)


@dataclass(frozen=True)
class Dose:
    timestamp: datetime
    mg: float


@dataclass(frozen=True)
class Interval:
    start: datetime
    end: datetime


def merge_intervals(intervals: list[Interval]) -> list[Interval]:
    ordered = sorted((Interval(utc(i.start), utc(i.end)) for i in intervals), key=lambda i: i.start)
    result: list[Interval] = []
    for interval in ordered:
        if interval.end <= interval.start:
            raise ValueError('Sleep must end after it starts')
        if result and interval.start <= result[-1].end:
            result[-1] = Interval(result[-1].start, max(result[-1].end, interval.end))
        else:
            result.append(interval)
    return result


def caffeine(doses: list[Dose], at: datetime, params: PredictionParameters) -> tuple[float, float]:
    remaining, effective = 0.0, 0.0
    for dose in doses:
        if not isfinite(dose.mg) or dose.mg < 0:
            raise ValueError('Caffeine dose must be finite and nonnegative')
        age = (utc(at) - utc(dose.timestamp)).total_seconds() / 3600
        if age < 0:
            continue
        amount = dose.mg * 0.5 ** (age / params.caffeine_half_life_hours)
        remaining += amount
        effective += amount * (1 - exp(-age / params.caffeine_onset_tau_hours))
    return remaining, effective


def combine_score(recovery: float, circadian_value: float, inertia: float, effective_mg: float, params: PredictionParameters) -> float:
    baseline = clip(recovery + params.circadian_amplitude * circadian_value - inertia)
    effect = effective_mg / (params.caffeine_half_effect_mg + effective_mg)
    return 100 * clip(baseline + params.caffeine_max_restoration * effect * (1 - baseline))


def pressure_at(intervals: list[Interval], at: datetime, params: PredictionParameters) -> tuple[float, bool]:
    # Initialize immediately before the first recorded sleep using the reference
    # bedtime state. Reset at long unknown gaps instead of simulating missed sleep
    # as continuous wakefulness. Both are disclosed fallback assumptions.
    pressure = pressure_after(reference_pressure(params), 16, False, params)
    cursor = intervals[0].start
    reset = False
    for interval in intervals:
        if interval.start > at:
            break
        gap = (interval.start - cursor).total_seconds() / 3600
        if gap > params.max_unobserved_wake_hours:
            pressure = pressure_after(reference_pressure(params), 16, False, params)
            reset = True
        else:
            pressure = pressure_after(pressure, max(0, gap), False, params)
        end = min(interval.end, at)
        pressure = pressure_after(pressure, (end - interval.start).total_seconds() / 3600, True, params)
        cursor = end
        if at <= interval.end:
            return pressure, reset
    return pressure_after(pressure, max(0, (at - cursor).total_seconds() / 3600), False, params), reset


def predict(*, now: datetime, zone: ZoneInfo, sleep: list[Interval], naps: list[Interval],
            doses: list[Dose], active: bool, params: PredictionParameters,
            wake_hour: float | None = None, personal_goal: int | None = None) -> EnergyPrediction:
    now = utc(now)
    # No future data leakage, including a session that ended after prediction time.
    sleep = [i for i in sleep if utc(i.end) <= now]
    naps = [i for i in naps if utc(i.end) <= now]
    combined = merge_intervals(sleep + naps)
    warnings = ['Heuristic alertness estimate; not a scientifically validated measurement.',
                'Session duration is treated as sleep; actual sleep stages and latency are unknown.',
                'Unlogged sleep cannot be distinguished from wakefulness.']
    assumptions = ['Fixed 8-hour physiological reference; personal sleep goals do not change recovery.',
                   'Initial pressure assumes reference bedtime state before the first recorded interval.',
                   'Short gaps following logged sleep are assumed awake; long gaps reset the unknown prior state.',
                   'Forecast assumes continued wakefulness with no new caffeine, sleep, or naps.',
                   'No caffeine logs means no logged intake, not confirmed abstinence.']
    assumptions.append(f'Inputs are limited to a {params.history_days}-day history window; earlier caffeine is omitted.')
    assumptions.append('Caffeine onset ramps the modeled effect; remaining mg still uses immediate-dose exponential elimination.')
    if active:
        assumptions.append('An active sleep or nap has an unknown end; alertness forecasts are unavailable until it is stopped.')
    if wake_hour is None:
        wake_hour = params.fallback_wake_hour
        warnings.append('Usual wake time missing; using configurable 07:00 local fallback by default.')
    main_end = max((utc(i.end) for i in sleep), default=None)
    last_end = combined[-1].end if combined else None
    eligible = main_end is not None and (now - main_end).total_seconds() <= params.max_unobserved_wake_hours * 3600
    if not eligible:
        warnings.append('No sufficiently recent recorded main sleep; alertness unavailable rather than assuming prolonged wakefulness.')
    elif combined and pressure_at(combined, now, params)[1]:
        warnings.append('Long unknown history gap: prior pressure was reset to the reference bedtime assumption.')
    if len(sleep) < 2:
        warnings.append('Limited recorded sleep history; initial-state uncertainty is substantial.')
    if len(combined) < len(sleep) + len(naps):
        warnings.append('Overlapping or adjacent sleep and nap intervals merged to prevent double counting.')

    def point(at: datetime) -> PredictionPoint:
        remaining, effective = caffeine(doses, at, params)
        status = 'sleeping' if active else 'estimated' if eligible else 'unavailable'
        score = None
        if status == 'estimated' and combined and last_end is not None:
            pressure, _ = pressure_at(combined, at, params)
            local = at.astimezone(zone)
            hour = local.hour + local.minute / 60 + local.second / 3600
            duration = (combined[-1].end - combined[-1].start).total_seconds() / 3600
            inertia = sleep_inertia(duration, (at - last_end).total_seconds() / 3600, params)
            score = round(combine_score(sleep_recovery(pressure, params), circadian(hour, wake_hour, params), inertia, effective, params), 1)
        return PredictionPoint(timestamp=at.astimezone(zone), score=score,
                               caffeine_remaining_mg=round(remaining, 2), status=status)

    current = point(now)
    # Step in UTC so repeated/missing local DST hours remain correct.
    at = now.astimezone(zone).replace(minute=0, second=0, microsecond=0).astimezone(UTC) + timedelta(hours=1)
    forecast = []
    while at.astimezone(zone).date() == now.astimezone(zone).date():
        forecast.append(point(at))
        at += timedelta(hours=1)
    return EnergyPrediction(**current.model_dump(), timezone=zone.key, forecast=forecast,
        data_quality='limited' if current.status == 'estimated' else 'unavailable',
        assumptions=assumptions, warnings=warnings, personal_sleep_goal_minutes=personal_goal, parameters=params)
