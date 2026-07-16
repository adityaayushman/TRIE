import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    """An account that may write telemetry.

    Reads stay public: a reviewer or examiner should be able to look at the
    dashboard without an account. Writes (POST /risk/assess) require one,
    because that endpoint appends to a shared database.
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    # bcrypt output, never the password. 60 chars for the standard hash, with
    # headroom in case the algorithm's prefix changes.
    password_hash: Mapped[str] = mapped_column(String(128))
    organisation: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
