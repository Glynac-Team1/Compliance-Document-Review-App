# backend/app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    database_url: str = "postgresql+asyncpg://compliance:compliance@localhost:5433/compliance_review"
    redis_url: str = "redis://localhost:6379/0"
    session_secret: str = "dev-secret-change-me"
    llm_provider: str = "gemini"
    llm_api_key: str | None = None
    max_upload_mb: int = 10
    allowed_mime_types: set[str] = {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }


settings = Settings()
