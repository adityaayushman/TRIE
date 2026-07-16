from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="TRIE_")

    app_name: str = "Smart Road Guardian AI X"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+asyncpg://trie:trie@localhost:5432/trie"
    cors_origins: list[str] = ["http://localhost:3000"]

    @field_validator("database_url")
    @classmethod
    def _use_asyncpg_driver(cls, value: str) -> str:
        """Managed Postgres hosts (Render, Heroku, Railway, ...) inject a bare
        postgresql:// (or the older postgres://) URL, but the async engine
        needs the +asyncpg dialect explicit in the scheme. Normalizing here
        means deploying to one of them needs no hand-edited connection string.
        """
        for prefix in ("postgresql://", "postgres://"):
            if value.startswith(prefix):
                return "postgresql+asyncpg://" + value[len(prefix):]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
