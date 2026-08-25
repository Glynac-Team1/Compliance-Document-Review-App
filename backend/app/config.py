# backend/app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    redis_url: str
    session_secret: str = "dev-secret-change-me"
    llm_provider: str = "gemini"
    llm_api_key: str | None = None


settings = Settings()
