from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ai.blackspot import BlackSpotEngine, RiskObservation
from ai.blackspot.geo import DEFAULT_CELL_SIZE_M
from ai.common.types import RiskLevel, VehicleDynamics
from ai.no_camera import telemetry_only_pipeline
from ai.pipeline import TransportationRiskPipeline
from app.db.session import get_db
from app.models.risk_event import RiskEvent
from app.schemas.risk import (
    BlackSpotRead,
    DetectedObjectRead,
    RiskAssessmentRequest,
    RiskAssessmentResponse,
    RiskEventRead,
)
from app.websockets.manager import manager

router = APIRouter(prefix="/risk", tags=["risk"])

# One pipeline per process, built lazily. Exposed as a dependency
# (`get_pipeline`) so tests can override it via app.dependency_overrides.
_pipeline: TransportationRiskPipeline | None = None


def get_pipeline() -> TransportationRiskPipeline:
    """The telemetry-only pipeline this API actually needs.

    No camera feed is wired to the JSON API: `POST /assess` carries telemetry,
    never frames — a real deployment runs perception at the edge
    (`ai/ingestion/`, `ai/cli.py`) and sends results on. This used to build the
    full pipeline and run YOLO/MediaPipe against a blank frame, which detects
    nothing by construction, so the output is identical either way — but the
    real engines pulled ~2GB of model weights into a process that never had an
    image to look at. See ai/no_camera.py.
    """
    global _pipeline
    if _pipeline is None:
        _pipeline = telemetry_only_pipeline()
    return _pipeline


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
    # No frames: the engines behind this pipeline report an unobserved camera
    # rather than inspecting an image. See get_pipeline().
    result = pipeline.run(
        road_frame=None,
        cabin_frame=None,
        vehicle=vehicle,
        vehicle_id=request.vehicle_id,
    )

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
        unobserved_factors=result.risk.unobserved_factors,
        potholes=[
            DetectedObjectRead(label=p.label, confidence=p.confidence, bbox=p.bbox)
            for p in result.road.potholes
        ],
        cracks=[
            DetectedObjectRead(label=c.label, confidence=c.confidence, bbox=c.bbox)
            for c in result.road.cracks
        ],
        is_waterlogged=result.road.is_waterlogged,
        surface_quality_score=result.road.surface_quality_score,
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
    near_miss_level: RiskLevel = Query(
        RiskLevel.HIGH,
        description=(
            "Minimum risk level counted as a near-miss. A study knob, and load-bearing: "
            "a telemetry-only deployment (no camera) tops out at ~35% because speed is "
            "its only live factor, so at the HIGH default nothing it records can ever "
            "qualify. Lower it to exercise the engine against telemetry-only data."
        ),
    ),
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
        near_miss_level=near_miss_level,
    )
    return [BlackSpotRead.model_validate(spot) for spot in engine.discover(observations)]
