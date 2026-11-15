"""Append-only, self-reported observations for future time-aligned ML labels."""
from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StrictInt, field_validator

Rating = Annotated[StrictInt, Field(ge=1, le=10)]


class EnergyCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    energy_rating: Rating
    recorded_at: AwareDatetime | None = None

    @field_validator('recorded_at', mode='before')
    @classmethod
    def validate_timestamp(cls, value):
        if value is not None and not isinstance(value, (str, datetime)):
            raise ValueError('Use an ISO timestamp with a UTC offset')
        return value


class EnergyCheckin(BaseModel):
    id: UUID
    user_id: UUID
    energy_rating: Rating
    recorded_at: AwareDatetime
    created_at: AwareDatetime


class EnergyHistory(BaseModel):
    items: list[EnergyCheckin]
    limit: int
    offset: int
    has_more: bool
