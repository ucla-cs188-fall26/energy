"""Caffeine amounts are per consumed serving and are estimates, not measurements."""
from datetime import date
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator

Amount = Annotated[Decimal, Field(ge=0, lt=100000000, max_digits=10, decimal_places=2, allow_inf_nan=False)]
Serving = Annotated[Decimal, Field(gt=0, lt=100000000, max_digits=10, decimal_places=2, allow_inf_nan=False)]
Name = Annotated[str, Field(min_length=1, max_length=150)]
Method = Literal['manual', 'preset', 'camera']


class CaffeineInput(BaseModel):
    model_config = ConfigDict(extra='forbid')

    @field_validator('*', mode='before')
    @classmethod
    def validate_values(cls, value, info):
        if info.field_name in {'caffeine_mg', 'serving_size_ml'} and isinstance(value, bool):
            raise ValueError('Use a finite numeric amount')
        if info.field_name == 'consumed_at' and value is not None and not isinstance(value, str):
            raise ValueError('Use an ISO timestamp including a UTC offset')
        if info.field_name == 'beverage_name' and isinstance(value, str) and (not value.strip() or value != value.strip()):
            raise ValueError('Name must be nonempty without surrounding whitespace')
        return value


class CaffeineCreate(CaffeineInput):
    beverage_name: Name | None = None
    caffeine_mg: Amount | None = None
    serving_size_ml: Serving | None = None
    consumed_at: AwareDatetime | None = None
    logging_method: Method = 'manual'
    preset_id: Annotated[str, Field(min_length=1, max_length=150)] | None = None

    @model_validator(mode='after')
    def require_source(self):
        if self.logging_method == 'preset':
            if not self.preset_id:
                raise ValueError('Preset logging requires preset_id')
        else:
            if self.preset_id is not None:
                raise ValueError('preset_id requires logging_method=preset')
            if any(value is None for value in (self.beverage_name, self.caffeine_mg, self.serving_size_ml)):
                raise ValueError('Beverage name, caffeine amount and serving size are required')
        return self


class CaffeineUpdate(CaffeineInput):
    beverage_name: Name | None = None
    caffeine_mg: Amount | None = None
    serving_size_ml: Serving | None = None
    consumed_at: AwareDatetime | None = None
    logging_method: Method | None = None

    @model_validator(mode='after')
    def require_changes(self):
        if not self.model_fields_set or any(getattr(self, key) is None for key in self.model_fields_set):
            raise ValueError('Supply at least one non-null field to update')
        return self


class CaffeineLog(BaseModel):
    id: UUID
    user_id: UUID
    beverage_name: Name
    caffeine_mg: Amount
    serving_size_ml: Serving
    consumed_at: AwareDatetime
    logging_method: Method
    created_at: AwareDatetime
    updated_at: AwareDatetime


class CaffeinePreset(BaseModel):
    id: str
    beverage_name: Name
    caffeine_mg: Amount
    serving_size_ml: Serving
    created_at: AwareDatetime
    updated_at: AwareDatetime


class CaffeineHistory(BaseModel):
    items: list[CaffeineLog]
    limit: int
    offset: int
    has_more: bool


class CaffeineDailyTotal(BaseModel):
    date: date
    timezone: str
    total_caffeine_mg: Decimal
    log_count: int
