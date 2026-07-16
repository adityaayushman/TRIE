from datetime import datetime, timedelta, timezone

import numpy as np
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ai.blackspot import BlackSpotEngine, RiskObservation
from ai.blackspot.geo import DEFAULT_CELL_SIZE_M
from ai.common.types import RiskLevel, VehicleDynamics
from ai.pipeline import TransportationRiskPipeline
from app.db.session import get_db
from app.models.risk_event import RiskEvent
from app.schemas.risk import (
    BlackSpotRead,
    RiskAssessmentRequest,
    RiskAssessmentResponse,
    RiskEventRead,
)
from app.websockets.manager import manager

router = APIRouter(prefix="/risk", tags=["risk"])

# One pipeline per process, built lazily so importing the app never loads model
# weights — only the first real assessment does. Exposed as a dependency
# (`get_pipeline`) so tests can override it with model-free fake engines via
# app.dependency_overrides.
_pipeline: TransportationRiskPipeline | None = None


def get_pipeline() -> TransportationRiskPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = TransportationRiskPipeline()
    return _pipeline


# No camera feed is wired to the JSON API: a real deployment streams frames
# through ai/ingestion/ and correlates them by vehicle_id + timestamp. The
# assess endpoint scores telemetry against a blank frame. See ai/pipeline.py.
_BLANK_FRAME = np.zeros((480, 640, 3), dtype=np.uint8)


@router.post("/assess", response_model=RiskAssessmentResponse)
async def assess_risk(
    request: RiskAssessmentRequest,
    db: AsyncSession = Depends(get_db),
    pipeline: TransportationRiskPipeline = Depends(get_pipeline),
) -> RiskAssessmentResponse:
    vehicle = VehicleDynamics(
        speed_kmh=request.speed_kmh,
        acceleration_ms2=request.acceleration_ms2,
        heading_deg=request.heading_deg,
    )
    result = pipeline.run(road_frame=_BLANK_FRAME, cabin_frame=_BLANK_FRAME, vehicle=vehicle)

    event = RiskEvent(
        vehicle_id=request.vehicle_id,
        risk_score=result.risk.risk_score,
        risk_level=result.risk.risk_level.value,
        primary_cause=result.causal.primary_cause,
        secondary_causes=result.causal.secondary_causes,
        predicted_event=result.causal.predicted_event,
        recommended_actions=result.recommendation.actions,
        contributing_factors=result.risk.contributing_factors,
        explanation=result.recommendation.explanation,
        latitude=request.latitude,
        longitude=request.longitude,
    )
    db.add(event)
    await db.commit()

    response = RiskAssessmentResponse(
        vehicle_id=request.vehicle_id,
        risk_score=result.risk.risk_score,
        risk_level=result.risk.risk_level.value,
        contributing_factors=result.risk.contributing_factors,
        future_risk_score=result.forecast.future_risk_score,
        time_to_risk_s=result.forecast.time_to_risk_s,
        collision_probability=result.forecast.collision_probability,
        primary_cause=result.causal.primary_cause,
        secondary_causes=result.causal.secondary_causes,
        predicted_event=result.causal.predicted_event,
        recommended_actions=result.recommendation.actions,
        explanation=result.recommendation.explanation,
        latitude=request.latitude,
        longitude=request.longitude,
    )
    await manager.broadcast(response.model_dump())
    return response


@router.get("/events", response_model=list[RiskEventRead])
async def list_recent_events(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
) -> list[RiskEvent]:
    result = await db.execute(
        select(RiskEvent).order_by(RiskEvent.created_at.desc()).limit(limit)
    )
    return list(result.scalars().all())


@router.get("/blackspots", response_model=list[BlackSpotRead])
async def discover_blackspots(
    days: int = Query(90, ge=1, description="How far back to draw evidence from"),
    cell_size_m: float = Query(DEFAULT_CELL_SIZE_M, gt=0, description="Spatial bin size"),
    min_exposure: int = Query(30, ge=1, description="Vehicle passes required to nominate"),
    min_near_misses: int = Query(5, ge=1, description="Near-misses required to nominate"),
    sample_limit: int = Query(200_000, ge=1, description="Cap on observations loaded"),
    db: AsyncSession = Depends(get_db),
) -> list[BlackSpotRead]:
    """Nominate dangerous road stretches from near-miss telemetry.

    Unlike iRAD/e-DAR, which flags a stretch only after five fatal/grievous
    crashes or ten deaths in three years, this needs no one to have died — only
    enough vehicles to have had trouble in the same place.

    The parameters are exposed because they are the study's knobs: cell size,
    and the evidence thresholds a stretch must clear.

    Note: aggregation happens in Python over rows loaded from the database, so
    `sample_limit` bounds memory. Beyond a few hundred thousand observations
    this wants to be a PostGIS/SQL-side aggregation or a periodic rollup rather
    than an on-demand endpoint.
    """
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(RiskEvent)
        .where(
            RiskEvent.latitude.is_not(None),
            RiskEvent.longitude.is_not(None),
            RiskEvent.created_at >= since,
        )
        .order_by(RiskEvent.created_at.desc())
        .limit(sample_limit)
    )

    observations = [
        RiskObservation(
            vehicle_id=event.vehicle_id,
            latitude=event.latitude,
            longitude=event.longitude,
            timestamp=event.created_at,
            risk_score=event.risk_score,
            risk_level=RiskLevel(event.risk_level),
            contributing_factors=event.contributing_factors or {},
        )
        for event in result.scalars().all()
    ]

    engine = BlackSpotEngine(
        cell_size_m=cell_size_m,
        min_exposure=min_exposure,
        min_near_misses=min_near_misses,
    )
    return [BlackSpotRead.model_validate(spot) for spot in engine.discover(observations)]
