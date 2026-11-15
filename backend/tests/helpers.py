"""Deterministic settings for tests without loading the project's .env file."""

from pydantic_settings import SettingsConfigDict

from energy_api.core.config import Settings


class _TestSettings(Settings):
    model_config = SettingsConfigDict(env_file=None)


def make_settings(*, configured: bool = True) -> Settings:
    # Validate aliases through a mapping instead of Pydantic's synthesized
    # constructor signature, which does not expose BaseSettings runtime kwargs.
    return _TestSettings.model_validate({
        "SUPABASE_URL": "https://example.supabase.co" if configured else None,
        "SUPABASE_PUBLISHABLE_KEY": "sb_publishable_test" if configured else None,
    })
