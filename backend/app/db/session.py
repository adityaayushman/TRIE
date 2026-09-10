from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()
# statement_cache_size=0 makes asyncpg safe behind a transaction-mode connection
# pooler (Supabase pgbouncer, PgBouncer, Render, ...), which does not support the
# server-side prepared statements asyncpg caches by default. Harmless on a direct
# or session-mode connection — so the same code works with any managed Postgres.
engine = create_async_engine(
    settings.database_url,
    echo=False,
    connect_args={"statement_cache_size": 0},
)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session
