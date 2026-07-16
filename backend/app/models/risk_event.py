import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RiskEvent(Base):
    """Persisted output of one ai.pipeline.TransportationRiskPipeline.run() call."""

    __tablename__ = "risk_events"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    vehicle_id: Mapped[str] = mapped_column(String(64), index=True)
    risk_score: Mapped[float] = mapped_column(Float)
    risk_level: Mapped[str] = mapped_column(String(16))
    primary_cause: Mapped[str] = mapped_column(String(128))
    predicted_event: Mapped[str] = mapped_column(String(128))
    recommended_actions: Mapped[list] = mapped_column(JSON, default=list)
    contributing_factors: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
