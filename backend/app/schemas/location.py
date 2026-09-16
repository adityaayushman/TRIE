import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LocationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: str = Field(default="", max_length=2000)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class LocationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str
    latitude: float
    longitude: float
    created_at: datetime


class LocationSummary(LocationRead):
    """LocationRead plus a live rollup — what the list view actually needs to
    render a card without a second round trip per location. Zeros/None are
    honest: a location with no assessments yet has genuinely nothing to show,
    not a fetch failure."""

    event_count: int = 0
    latest_risk_score: float | None = None
    latest_risk_level: str | None = None
    latest_event_at: datetime | None = None
