from collections.abc import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()
# statement_cache_size=0 makes asyncpg safe behind a transaction-mode connection
# pooler (Supabase pgbouncer, PgBouncer, Render, ...), which does not support the
# server-side prepared statements asyncpg caches by default. Harmless on a direct
# or session-mode connection — so the same code works with any managed Postgres.
# asyncpg-only, though: the test suite runs on sqlite+aiosqlite (see
# tests/conftest.py), whose connect() rejects an unknown kwarg outright, so
# this is gated on the dialect rather than passed unconditionally.
_connect_args = {"statement_cache_size": 0} if settings.database_url.startswith("postgresql+asyncpg") else {}
engine = create_async_engine(
    settings.database_url,
    echo=False,
    connect_args=_connect_args,
)

# SQLite ignores every FOREIGN KEY ... ON DELETE clause unless a connection
# turns enforcement on for itself — off by default for backward compatibility
# with pre-3.6.19 databases. Without this, `ondelete="SET NULL"` (e.g.
# risk_events.location_id when its Location is deleted) is silently a no-op
# on the sqlite+aiosqlite test database, while behaving correctly on the
# Postgres this actually deploys to — a real behavioural gap between test and
# production, not just a test convenience. Postgres enforces FK actions
# unconditionally, so this listener only ever attaches for sqlite.
if engine.dialect.name == "sqlite":

    @event.listens_for(engine.sync_engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
        dbapi_connection.execute("PRAGMA foreign_keys=ON")


async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session
