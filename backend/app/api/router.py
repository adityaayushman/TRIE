from fastapi import APIRouter

from app.api.routes import alerts, auth, health, locations, risk

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(risk.router)
api_router.include_router(alerts.router)
api_router.include_router(locations.router)
