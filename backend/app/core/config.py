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
    # Comma-separated browser origins (local Vite and/or Netlify in production).
    # Example prod: "https://tu-app.netlify.app"
    cors_origins: str = "http://localhost:5175"
    uploads_root: str = "/uploads"

    def get_cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def get_uploads_products_dir(self) -> str:
        return f"{self.uploads_root.rstrip('/')}/products"


@lru_cache
def get_settings() -> Settings:
    return Settings()
