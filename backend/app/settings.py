from functools import lru_cache
from pathlib import Path

from pydantic import AnyHttpUrl, Field, HttpUrl, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/.env, resolved from this file so the server can start from any directory.
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE, extra="ignore", hide_input_in_errors=True
    )

    supabase_url: HttpUrl = Field(validation_alias="SUPABASE_URL")
    supabase_secret_key: SecretStr = Field(validation_alias="SUPABASE_SECRET_KEY")
    frontend_origin: AnyHttpUrl = Field(validation_alias="FRONTEND_ORIGIN")
    gemini_api_key: SecretStr | None = Field(
        default=None, validation_alias="GEMINI_API_KEY"
    )
    openai_api_key: SecretStr | None = Field(
        default=None, validation_alias="OPENAI_API_KEY"
    )
    anthropic_api_key: SecretStr | None = Field(
        default=None, validation_alias="ANTHROPIC_API_KEY"
    )

    @property
    def cors_origin(self) -> str:
        """FRONTEND_ORIGIN as sent in the Origin header (no trailing slash)."""
        return str(self.frontend_origin).rstrip("/")

    @field_validator("supabase_url")
    @classmethod
    def require_https(cls, value: HttpUrl) -> HttpUrl:
        if value.scheme != "https":
            raise ValueError("SUPABASE_URL must use https")
        return value

    @field_validator("supabase_secret_key")
    @classmethod
    def require_secret_key(cls, value: SecretStr) -> SecretStr:
        if not value.get_secret_value().startswith("sb_secret_"):
            raise ValueError("SUPABASE_SECRET_KEY must use sb_secret_ format")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
