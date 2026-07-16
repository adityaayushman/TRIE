"""Test fixtures for the backend API.

Tests run against SQLite rather than PostgreSQL so the suite needs no running
database. app/db/session.py builds its engine from settings at import time, so
TRIE_DATABASE_URL must be set before anything under app/ is imported.
"""
from __future__ import annotations

import asyncio
import os
import pathlib
import tempfile

import pytest

_DB_PATH = pathlib.Path(tempfile.gettempdir()) / "trie_test.db"
os.environ["TRIE_DATABASE_URL"] = f"sqlite+aiosqlite:///{_DB_PATH.as_posix()}"

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

from app.api.routes.risk import get_pipeline  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.main import app  # noqa: E402
from app.models import risk_event  # noqa: E402,F401  registers the table on Base

from ai.no_camera import telemetry_only_pipeline  # noqa: E402
from tests.fakes import dangerous_pipeline, fake_pipeline  # noqa: E402


@pytest.fixture(scope="session")
def client():
    """One client per session: TestClient owns an event loop, and the app's
    connection pool must not outlive the loop that created its connections.

    The pipeline is overridden with model-free fake engines so API tests need
    no ML stack and stay deterministic; the real fusion/causal/explainable
    logic still runs over the fakes' output.
    """
    shared = fake_pipeline()
    app.dependency_overrides[get_pipeline] = lambda: shared
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def clean_db(client):
    """Give every test an empty risk_events table.

    Uses a throwaway NullPool engine so this never leaves connections in a
    pool bound to this fixture's short-lived event loop.
    """

    async def _reset() -> None:
        engine = create_async_engine(os.environ["TRIE_DATABASE_URL"], poolclass=NullPool)
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.drop_all)
                await conn.run_sync(Base.metadata.create_all)
        finally:
            await engine.dispose()

    asyncio.run(_reset())
    yield


@pytest.fixture
def dangerous_scene(client):
    """Swap in a pipeline that reports HIGH risk when the vehicle moves fast,
    so black-spot tests can generate real near-misses to aggregate. Restores
    the default fake pipeline afterwards."""
    hazardous = dangerous_pipeline()
    app.dependency_overrides[get_pipeline] = lambda: hazardous
    yield
    shared = fake_pipeline()
    app.dependency_overrides[get_pipeline] = lambda: shared


@pytest.fixture
def moderate_scene(client):
    """Swap in the real telemetry-only pipeline — the one the deployed backend
    actually runs. With no camera, speed is the only live factor and risk tops
    out around 35% (MODERATE), which is exactly why `near_miss_level` matters:
    at the HIGH default this pipeline can never produce a near-miss."""
    telemetry = telemetry_only_pipeline()
    app.dependency_overrides[get_pipeline] = lambda: telemetry
    yield
    shared = fake_pipeline()
    app.dependency_overrides[get_pipeline] = lambda: shared
