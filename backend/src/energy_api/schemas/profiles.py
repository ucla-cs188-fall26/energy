"""Profile preferences accepted by the API and stored in Supabase."""

from datetime import datetime, time
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator

CaffeineFrequency = Literal["daily", "few_times_week", "rarely", "never"]
CaffeineSensitivity = Literal["low", "medium", "high"]
SideEffect = Literal[
    "jitters", "anxiety", "headaches", "sleep_disruption", "stomach_upset", "energy_crash",
]
Sex = Literal["female", "male"]
MeasurementUnits = Literal["metric", "imperial"]


class ProfilePreferences(BaseModel):
    """PUT merges supplied fields; omitted fields keep their existing values."""

    model_config = ConfigDict(extra="forbid")

    display_name: Annotated[str, Field(min_length=1, max_length=80)] | None = None
    usual_bedtime: time | None = None
    usual_wake_time: time | None = None
    sleep_goal_minutes: Annotated[StrictInt, Field(ge=1, le=1440)] | None = None
    caffeine_frequency: CaffeineFrequency | None = None
    caffeine_sensitivity: CaffeineSensitivity | None = None
    selected_side_effects: list[SideEffect] = Field(default_factory=list)
    initial_energy_rating: Annotated[StrictInt, Field(ge=1, le=10)] | None = None
    sex: Sex | None = None
    age_years: Annotated[StrictInt, Field(ge=13, le=120)] | None = None
    # Stored metric with one decimal place (numeric(4, 1) in the database).
    weight_kg: Annotated[float, Field(strict=True, ge=20, le=400)] | None = None
    height_cm: Annotated[float, Field(strict=True, ge=50, le=272)] | None = None
    measurement_units: MeasurementUnits | None = None

    @field_validator("weight_kg", "height_cm")
    @classmethod
    def round_measurement(cls, value: float | None) -> float | None:
        return None if value is None else round(value, 1)

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, value: str | None) -> str | None:
        if value is not None and (not value.strip() or value != value.strip()):
            raise ValueError("Display name must be nonempty without surrounding whitespace")
        return value

    @field_validator("usual_bedtime", "usual_wake_time", mode="before")
    @classmethod
    def validate_clock_input(cls, value):
        if value is not None and not isinstance(value, (str, time)):
            raise ValueError("Use a local clock time such as 23:00")
        return value

    @field_validator("usual_bedtime", "usual_wake_time")
    @classmethod
    def validate_local_time(cls, value: time | None) -> time | None:
        if value is not None and value.tzinfo is not None:
            raise ValueError("Usual sleep times must not include a timezone")
        return value

    @field_validator("selected_side_effects")
    @classmethod
    def validate_side_effects(cls, value: list[SideEffect]) -> list[SideEffect]:
        if len(value) != len(set(value)):
            raise ValueError("Selected side effects must be unique")
        return value


class UserProfile(ProfilePreferences):
    id: UUID
    preferences_completed: bool
    created_at: datetime
    updated_at: datetime
