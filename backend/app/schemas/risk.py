import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class RiskEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    vehicle_id: str
    risk_score: float
    risk_level: str
    primary_cause: str
    predicted_event: str
    recommended_actions: list[str]
    contributing_factors: dict[str, float]
    created_at: datetime


class RiskAssessmentRequest(BaseModel):
    """Request body for POST /risk/assess — vehicle telemetry for one tick.

    Camera frames are not sent over JSON in this stub API; a real deployment
    would stream frames separately (e.g. via the websocket or a media
    pipeline) and correlate them by vehicle_id + timestamp.
    """

    vehicle_id: str
    speed_kmh: float = 0.0
    acceleration_ms2: float = 0.0
    heading_deg: float = 0.0


class RiskAssessmentResponse(BaseModel):
    vehicle_id: str
    risk_score: float
    risk_level: str
    contributing_factors: dict[str, float]
    future_risk_score: float
    time_to_risk_s: float | None
    collision_probability: float
    primary_cause: str
    secondary_causes: list[str]
    predicted_event: str
    recommended_actions: list[str]
    explanation: str
