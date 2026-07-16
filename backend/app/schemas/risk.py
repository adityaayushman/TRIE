import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

# Reused wherever a GPS fix crosses the API. Optional throughout: a vehicle
# without a fix (tunnel, cheap hardware, revoked permission) must still get a
# risk assessment — it simply cannot contribute black-spot evidence.
Latitude = Field(default=None, ge=-90, le=90, description="WGS84 latitude")
Longitude = Field(default=None, ge=-180, le=180, description="WGS84 longitude")


class RiskEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    vehicle_id: str
    risk_score: float
    risk_level: str
    primary_cause: str
    secondary_causes: list[str]
    predicted_event: str
    recommended_actions: list[str]
    contributing_factors: dict[str, float]
    explanation: str
    latitude: float | None
    longitude: float | None
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
    latitude: float | None = Latitude
    longitude: float | None = Longitude


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
    latitude: float | None = None
    longitude: float | None = None


class BlackSpotRead(BaseModel):
    """A road stretch nominated as dangerous from near-miss telemetry.

    Mirrors ai/blackspot/engine.py BlackSpot.
    """

    model_config = ConfigDict(from_attributes=True)

    latitude: float
    longitude: float
    near_miss_count: int
    exposure: int
    incident_rate: float
    confidence: float
    dominant_cause: str
    cause_breakdown: dict[str, float]
    intervention: str
    radius_m: float
    qualifies_under_irad: bool
    first_seen: datetime
    last_seen: datetime
