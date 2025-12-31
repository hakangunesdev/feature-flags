from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

BASE_DIR = Path(__file__).resolve().parents[2]

class Settings(BaseSettings):
    DB_URL: str = Field("sqlite:///./feature_flags.db", validation_alias="DATABASE_URL")
    REDIS_URL: str = Field("redis://localhost:6379/0", validation_alias="REDIS_URL")

    JWT_SECRET: str = "CHANGE_ME"
    JWT_ALG: str = "HS256"

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()
#db bağlantıları ayarlarını tutmaktadır.
