"""Profile preferences accepted by the API and stored in Supabase."""

from datetime import datetime, time
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator

CaffeineFrequency = Literal["never", "occasionally", "daily"]
CaffeineSensitivity = Literal["low", "medium", "high"]
SideEffect = Literal["jitters", "anxiety", "palpitations", "sleep_disruption", "stomach_upset"]


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
