from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="TRIE_")

    app_name: str = "Smart Road Guardian AI X"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+asyncpg://trie:trie@localhost:5432/trie"
    cors_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
