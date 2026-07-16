from fastapi import APIRouter

from app.api.routes import alerts, health, risk

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(risk.router)
api_router.include_router(alerts.router)
