import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    app_env: str = os.getenv("APP_ENV", "development")
    app_timezone: str = os.getenv("APP_TIMEZONE", "Asia/Seoul")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./nexus.db")


settings = Settings()

