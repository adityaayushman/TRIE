"""Real Web Push delivery — the human-facing alerting loop.

The WebSocket in app/websockets/manager.py pushes to an *open dashboard tab*.
This closes the actual gap: a genuine OS/browser-level notification, delivered
by the browser's own push service (Chrome -> FCM, Firefox -> autopush, ...),
that reaches a rider or ICCC operator even with the tab closed. RFC 8291/8292
Web Push + VAPID, via `pywebpush` — no SMS/app-store account needed, and it
works the moment a deployment sets its own VAPID keypair (app/vapid_keys.py).

    from app.services.push import send_high_risk_alert
    await send_high_risk_alert(db, user_id, assessment_dict)
"""
from __future__ import annotations

import json
import logging
import uuid

from pywebpush import WebPushException, webpush
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.push_subscription import PushSubscription

logger = logging.getLogger(__name__)

# Only these levels page a human — a LOW/MODERATE assessment updates the
# dashboard silently over the websocket, exactly as before. Matches
# ai.common.types.RiskLevel's string values.
_ALERT_LEVELS = {"high", "critical"}


async def send_high_risk_alert(db: AsyncSession, user_id: uuid.UUID, assessment: dict) -> int:
    """Push a real notification to every subscription this user registered.

    No-ops (returns 0) below HIGH risk, or if this deployment has no VAPID
    keypair configured — a missing secret degrades to "no push alerts," never
    to a crash in the request that produced the assessment. Returns the count
    of subscriptions successfully notified.
    """
    if assessment.get("risk_level") not in _ALERT_LEVELS:
        return 0
    settings = get_settings()
    if not settings.vapid_public_key or not settings.vapid_private_key_b64:
        return 0

    import base64

    private_pem = base64.b64decode(settings.vapid_private_key_b64)

    result = await db.execute(select(PushSubscription).where(PushSubscription.user_id == user_id))
    subs = list(result.scalars().all())
    if not subs:
        return 0

    payload = json.dumps(
        {
            "title": f"{assessment['risk_level'].upper()} risk — {assessment.get('vehicle_id', 'vehicle')}",
            "body": assessment.get("explanation") or assessment.get("primary_cause") or "Elevated road risk detected.",
            "risk_score": assessment.get("risk_score"),
            "url": "/dashboard/live",
        }
    )

    sent = 0
    stale_ids: list[uuid.UUID] = []
    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=private_pem.decode(),
                vapid_claims={"sub": settings.vapid_subject},
            )
            sent += 1
        except WebPushException as exc:
            # 404/410 = the browser or OS discarded this subscription
            # (uninstalled, permission revoked, expired) — clean it up rather
            # than retrying it forever. Any other failure just skips this one
            # subscription; it must never fail the assessment request itself.
            status = getattr(exc.response, "status_code", None)
            if status in (404, 410):
                stale_ids.append(sub.id)
            else:
                logger.warning("push delivery failed for subscription %s: %s", sub.id, exc)

    if stale_ids:
        await db.execute(delete(PushSubscription).where(PushSubscription.id.in_(stale_ids)))
        await db.commit()

    return sent
