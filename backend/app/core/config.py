from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "TrazApp"
    app_env: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    database_url: str = (
        "postgresql+psycopg2://trazapp:trazapp_dev_password@localhost:5432/trazapp"
    )
    jwt_secret_key: str = "change-me-dev-only-jwt-secret"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60


@lru_cache
def get_settings() -> Settings:
    return Settings()
