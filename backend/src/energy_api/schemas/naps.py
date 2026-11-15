"""Nap timestamps represent instants; durations are calculated in UTC."""
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StrictInt, field_validator, model_validator

Quality = Annotated[StrictInt, Field(ge=1, le=5)]


class NapInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_validator("*", mode="before")
    @classmethod
    def require_datetime_strings(cls, value, info):
        if info.field_name in {"started_at", "ended_at"} and value is not None:
            if not isinstance(value, (str, datetime)):
                raise ValueError("Use an ISO timestamp with a UTC offset")
        return value


class NapStart(NapInput):
    started_at: AwareDatetime | None = None


class NapStop(NapInput):
    ended_at: AwareDatetime | None = None
    refreshed_rating: Quality | None = None


class NapRating(NapInput):
    refreshed_rating: Quality


class NapRecord(BaseModel):
    id: UUID
    user_id: UUID
    started_at: AwareDatetime
    ended_at: AwareDatetime | None
    duration_seconds: Annotated[float, Field(ge=0, allow_inf_nan=False)] | None
    refreshed_rating: Annotated[int, Field(ge=1, le=5)] | None
    created_at: AwareDatetime
    updated_at: AwareDatetime

    @model_validator(mode="after")
    def validate_interval(self):
        if self.ended_at is not None:
            if self.ended_at.astimezone(timezone.utc) <= self.started_at.astimezone(timezone.utc):
                raise ValueError("Nap must end after it starts")
        elif self.refreshed_rating is not None or self.duration_seconds is not None:
            raise ValueError("Active sessions cannot have a final duration or rating")
        return self


class NapSession(NapRecord):
    elapsed_seconds: float


class NapHistory(BaseModel):
    items: list[NapSession]
    limit: int
    offset: int
    has_more: bool
