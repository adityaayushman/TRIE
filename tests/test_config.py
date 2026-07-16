"""Tests for backend/app/core/config.py's database URL normalization.

Managed Postgres hosts (Render, Heroku, Railway, ...) inject a bare
postgresql:// or postgres:// URL; the async engine needs +asyncpg explicit
in the scheme. Getting this wrong means a deploy fails at first connection
with an unhelpful driver error, so it is worth pinning directly.
"""
from __future__ import annotations

from app.core.config import Settings


def test_postgresql_scheme_gets_the_asyncpg_driver():
    settings = Settings(database_url="postgresql://user:pass@host:5432/db")
    assert settings.database_url == "postgresql+asyncpg://user:pass@host:5432/db"


def test_legacy_postgres_scheme_gets_the_asyncpg_driver():
    """Heroku-style URLs use the older postgres:// scheme."""
    settings = Settings(database_url="postgres://user:pass@host:5432/db")
    assert settings.database_url == "postgresql+asyncpg://user:pass@host:5432/db"


def test_a_url_already_specifying_asyncpg_is_left_alone():
    settings = Settings(database_url="postgresql+asyncpg://user:pass@host:5432/db")
    assert settings.database_url == "postgresql+asyncpg://user:pass@host:5432/db"


def test_sqlite_urls_are_not_touched():
    settings = Settings(database_url="sqlite+aiosqlite:///test.db")
    assert settings.database_url == "sqlite+aiosqlite:///test.db"
