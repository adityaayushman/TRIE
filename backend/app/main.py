from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings

settings = get_settings()

# Schema is managed by Alembic (backend/alembic/), not create_all: run
# `alembic upgrade head` before starting the app (see README). The Docker
# image's CMD does this automatically; local/test setups apply their own
# schema directly (tests/conftest.py) or via the migration.
app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)
