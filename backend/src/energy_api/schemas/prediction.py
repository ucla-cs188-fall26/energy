from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class PredictionParameters(BaseModel):
    """Published time constants; score amplitudes/onset/coverage are MVP heuristics."""
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    wake_tau_hours: float = Field(default=18.2, gt=0)
    sleep_tau_hours: float = Field(default=4.2, gt=0)
    caffeine_half_life_hours: float = Field(default=5, gt=0)
    caffeine_onset_tau_hours: float = Field(default=0.5, gt=0)
    caffeine_half_effect_mg: float = Field(default=100, gt=0)
    caffeine_max_restoration: float = Field(default=0.25, ge=0, le=1)
    circadian_amplitude: float = Field(default=0.10, ge=0, le=1)
    inertia_amplitude: float = Field(default=0.10, ge=0, le=1)
    inertia_tau_hours: float = Field(default=0.67, gt=0)
    circadian_peak_after_wake_hours: float = Field(default=9, ge=0, lt=24)
    fallback_wake_hour: float = Field(default=7, ge=0, lt=24)
    max_unobserved_wake_hours: float = Field(default=20, gt=0, le=24)
    history_days: int = Field(default=7, ge=1, le=30)


class PredictionPoint(BaseModel):
    timestamp: datetime
    score: float | None = Field(ge=0, le=100)
    caffeine_remaining_mg: float = Field(ge=0)
    status: Literal['estimated', 'unavailable', 'sleeping']


class EnergyPrediction(PredictionPoint):
    model_type: str = 'two_process_heuristic'
    model_version: str = '1.0.0'
    timezone: str
    forecast: list[PredictionPoint]
    data_quality: Literal['limited', 'unavailable']
    assumptions: list[str]
    warnings: list[str]
    physiological_reference_sleep_hours: float = 8
    personal_sleep_goal_minutes: int | None = None
    parameters: PredictionParameters
