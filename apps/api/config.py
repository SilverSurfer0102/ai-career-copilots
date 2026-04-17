from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    log_level: str = "INFO"
    secret_key: str = "change-me-in-production"

    database_url: str = "postgresql+psycopg2://copilot:copilot@localhost:5432/career_copilot"

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"

    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 20

    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]


settings = Settings()
