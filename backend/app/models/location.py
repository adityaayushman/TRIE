import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Location(Base):
    """A registered camera/site — the identity multi-location scaling hangs
    off. Everything before this model treated the platform as one implicit
    stream: a vehicle_id and a raw lat/lon per event, with no way to ask "show
    me only NH48 Junction 4" or list the sites an operator manages. This is
    that missing entity — deliberately thin (name, a reference point,
    who registered it), because the actual per-location data (its risk
    history, its black-spot evidence) already lives in RiskEvent and the
    black-spot engine; a Location just gives a stable id and label to group
    and filter by, not a second copy of the telemetry.

    latitude/longitude here are the site's own fixed coordinates — distinct
    from RiskEvent.latitude/longitude, which is the reporting vehicle's GPS
    fix at assessment time (usually near-identical for a fixed camera, but
    conceptually different: a location's coordinates don't move; a vehicle's
    do). See assess_risk's location_id handling in app/api/routes/risk.py for
    how a fixed camera can omit its own GPS and inherit the location's fix.
    """

    __tablename__ = "locations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(128))
    description: Mapped[str] = mapped_column(Text, default="")
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
