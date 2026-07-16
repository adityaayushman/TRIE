import numpy as np
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ai.common.types import VehicleDynamics
from ai.pipeline import TransportationRiskPipeline
from app.db.session import get_db
from app.models.risk_event import RiskEvent
from app.schemas.risk import RiskAssessmentRequest, RiskAssessmentResponse, RiskEventRead
from app.websockets.manager import manager

router = APIRouter(prefix="/risk", tags=["risk"])

# One pipeline instance per process: cheap stub engines today, but this is
# also where a real deployment would hold loaded model weights.
_pipeline = TransportationRiskPipeline()

# Stub API has no camera feed wired up yet; frames come from perception
# hardware in a real deployment. See ai/pipeline.py docstring.
_BLANK_FRAME = np.zeros((480, 640, 3), dtype=np.uint8)


@router.post("/assess", response_model=RiskAssessmentResponse)
async def assess_risk(
    request: RiskAssessmentRequest,
    db: AsyncSession = Depends(get_db),
) -> RiskAssessmentResponse:
    vehicle = VehicleDynamics(
        speed_kmh=request.speed_kmh,
        acceleration_ms2=request.acceleration_ms2,
        heading_deg=request.heading_deg,
    )
    result = _pipeline.run(road_frame=_BLANK_FRAME, cabin_frame=_BLANK_FRAME, vehicle=vehicle)

    event = RiskEvent(
        vehicle_id=request.vehicle_id,
        risk_score=result.risk.risk_score,
        risk_level=result.risk.risk_level.value,
        primary_cause=result.causal.primary_cause,
        predicted_event=result.causal.predicted_event,
        recommended_actions=result.recommendation.actions,
        contributing_factors=result.risk.contributing_factors,
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
