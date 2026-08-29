# backend/app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    # Docker Networking: Use service names ('db', 'redis') instead of 'localhost'
    # Note: Internal Docker port for Postgres is 5432, even if mapped to 5433 on the host
    database_url: str = "postgresql+asyncpg://compliance:compliance@db:5432/compliance_review"
    redis_url: str = "redis://redis:6379/0"
    
    # MinIO (S3) Storage Configuration
    minio_endpoint: str = "http://minio:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket_name: str = "compliance-documents"

    # API & Security
    session_secret: str = "dev-secret-change-me"
    llm_provider: str = "gemini"
    llm_api_key: str | None = None
    
    # Upload Constraints
    max_upload_mb: int = 10
    allowed_mime_types: set[str] = {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }


settings = Settings()
