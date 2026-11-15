"""Application settings loaded from the environment or backend/.env."""

from pathlib import Path
from functools import lru_cache

from pydantic import AnyHttpUrl, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from energy_api.schemas.prediction import PredictionParameters


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="ENERGY_",
        env_file=Path(__file__).resolve().parents[3] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        env_nested_delimiter="__",
    )

    app_name: str = "Energy API"
    debug: bool = False
    prediction: PredictionParameters = Field(default_factory=PredictionParameters)
    cors_origins: list[str] = ["http://localhost:8081", "http://127.0.0.1:8081"]
    supabase_url: AnyHttpUrl | None = Field(default=None, validation_alias="SUPABASE_URL")
    supabase_publishable_key: SecretStr | None = Field(
        default=None, validation_alias="SUPABASE_PUBLISHABLE_KEY"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
