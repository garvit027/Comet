from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Comet"
    database_url: str = "postgresql+psycopg2://comet:comet@localhost:5432/comet"
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"

    secret_key: str = "change-this-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    auctioneer_approval_code: str = "COMET-ADMIN-2026"
    auto_approve_auctioneers: bool = False

    frontend_origin: str = "http://localhost:5173"


settings = Settings()
