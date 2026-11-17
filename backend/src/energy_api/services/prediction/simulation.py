"""Read-only hypothetical sleep input; no record creation or mutation."""
import asyncio
from datetime import timedelta
from typing import Annotated, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator

from energy_api.schemas.prediction import EnergyPrediction
from energy_api.services.prediction.formulas import Dose, Interval, predict
from energy_api.services.prediction.service import PredictionService


class SleepSimulationInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    duration_minutes: StrictInt
    timezone: Annotated[str, Field(min_length=1, max_length=100)]

    @field_validator('duration_minutes')
    @classmethod
    def allowed_duration(cls, value):
        if value not in {30, 60, 240, 360, 480}:
            raise ValueError('Choose 30, 60, 240, 360, or 480 minutes')
        return value


class SleepSimulationPrediction(EnergyPrediction):
    simulation: Literal[True] = True
    simulated_sleep_minutes: int


async def simulate_sleep(service: PredictionService, payload: SleepSimulationInput) -> SleepSimulationPrediction:
    try:
        zone = ZoneInfo(payload.timezone)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(422, 'Use an explicit valid IANA timezone') from None
    naps, caffeine, profile = await asyncio.gather(
        service._history(service.naps, 'started_at', completed=True),
        service._history(service.caffeine, 'consumed_at'),
        service._profile(),
    )
    wake = profile.usual_wake_time if profile else None
    result = predict(
        now=service.now, zone=zone,
        sleep=[Interval(service.now - timedelta(minutes=payload.duration_minutes), service.now)],
        naps=[Interval(row.started_at, row.ended_at) for row in naps if row.ended_at is not None],
        doses=[Dose(row.consumed_at, float(row.caffeine_mg)) for row in caffeine],
        active=False, params=service.params,
        wake_hour=wake.hour + wake.minute / 60 if wake else None,
        personal_goal=profile.sleep_goal_minutes if profile else None,
    )
    result.warnings.insert(0, 'Simulation only: hypothetical completed sleep; no records were written.')
    result.assumptions.append('Recorded main sleep is replaced only in this preview; actual caffeine, completed naps, and preferences are retained. Active sessions are ignored. Overlapping intervals are merged.')
    return SleepSimulationPrediction(**result.model_dump(), simulated_sleep_minutes=payload.duration_minutes)
