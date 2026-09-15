import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PushSubscription(Base):
    """A browser's Web Push subscription for one signed-in user.

    Real, working alert delivery: when POST /risk/assess produces a HIGH or
    CRITICAL assessment, every subscription for that user gets a genuine OS/
    browser-level push notification (see app/services/push.py) — not a mock
    endpoint. `endpoint` is the push service URL the browser chose (FCM,
    Mozilla's autopush, ...); `p256dh`/`auth` are the subscription's own
    encryption keys, required by the Web Push protocol (RFC 8291) to encrypt
    the payload so only that browser can read it.
    """

    __tablename__ = "push_subscriptions"
    __table_args__ = (UniqueConstraint("user_id", "endpoint", name="uq_push_subscription_user_endpoint"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    endpoint: Mapped[str] = mapped_column(Text)
    p256dh: Mapped[str] = mapped_column(String(255))
    auth: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
