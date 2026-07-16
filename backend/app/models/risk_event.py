import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, String, Text, func
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
    secondary_causes: Mapped[list] = mapped_column(JSON, default=list)
    predicted_event: Mapped[str] = mapped_column(String(128))
    recommended_actions: Mapped[list] = mapped_column(JSON, default=list)
    contributing_factors: Mapped[dict] = mapped_column(JSON, default=dict)
    explanation: Mapped[str] = mapped_column(Text, default="")

    # Nullable: a vehicle without a GPS fix still gets assessed, it just cannot
    # contribute to black-spot discovery. Plain columns rather than PostGIS
    # geometry because ai/blackspot/ bins points itself; a real deployment
    # doing spatial queries in SQL would want PostGIS and a GiST index here.
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Set client-side: SQL now() is whole-second on SQLite and transaction-start
    # on PostgreSQL, both of which tie for events written close together and make
    # "most recent first" ordering arbitrary. server_default only covers rows
    # inserted outside the ORM.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
