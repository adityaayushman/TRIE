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
    # "operator" (default) or "admin". Set once at registration from
    # settings.admin_emails (see app/core/config.py) — there is no promotion
    # endpoint, so a role can't be escalated after the fact by anything short
    # of a direct database edit. Gates exactly one thing today: DELETE
    # /risk/events/{id} (app/api/routes/risk.py) — reads stay public for
    # everyone, admin or not, per this project's public-read design.
    role: Mapped[str] = mapped_column(String(16), default="operator", server_default="operator")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
