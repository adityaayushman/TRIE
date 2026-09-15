from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.schemas.push import PushSubscriptionRequest, VapidPublicKeyResponse
from app.websockets.manager import manager

router = APIRouter(tags=["alerts"])


@router.websocket("/alerts/ws")
async def alerts_stream(websocket: WebSocket) -> None:
    """Dashboard clients connect here to receive live RiskAssessmentResponse
    payloads as they're produced by POST /risk/assess."""
    await manager.connect(websocket)
    try:
        while True:
            # Clients don't send anything meaningful; this just detects disconnects.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@router.get("/alerts/vapid-public-key", response_model=VapidPublicKeyResponse)
async def vapid_public_key() -> VapidPublicKeyResponse:
    """The frontend fetches this rather than hardcoding a key, so rotating
    the deployment's VAPID keypair needs no frontend redeploy. `enabled=False`
    means this deployment has no keypair set — the settings page shows push
    alerts as unavailable rather than failing a subscribe attempt."""
    settings = get_settings()
    return VapidPublicKeyResponse(public_key=settings.vapid_public_key, enabled=bool(settings.vapid_public_key))


@router.post("/alerts/subscribe", status_code=204)
async def subscribe(
    request: PushSubscriptionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
) -> None:
    """Register (or refresh) this browser's push subscription for the signed-in
    user. Idempotent: re-subscribing the same endpoint (the browser may return
    the same one, or rotate its keys) upserts rather than duplicating."""
    values = {
        "user_id": user.id,
        "endpoint": request.endpoint,
        "p256dh": request.keys.p256dh,
        "auth": request.keys.auth,
    }
    if db.bind.dialect.name == "postgresql":
        stmt = pg_insert(PushSubscription).values(**values)
        stmt = stmt.on_conflict_do_update(
            constraint="uq_push_subscription_user_endpoint",
            set_={"p256dh": stmt.excluded.p256dh, "auth": stmt.excluded.auth},
        )
        await db.execute(stmt)
    else:
        # SQLite (tests): no dialect-portable upsert import needed for one row.
        existing = await db.execute(
            select(PushSubscription).where(
                PushSubscription.user_id == user.id,
                PushSubscription.endpoint == request.endpoint,
            )
        )
        row = existing.scalar_one_or_none()
        if row is None:
            db.add(PushSubscription(**values))
        else:
            row.p256dh = request.keys.p256dh
            row.auth = request.keys.auth
    await db.commit()


@router.delete("/alerts/subscribe", status_code=204)
async def unsubscribe(
    endpoint: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
) -> None:
    """Remove this browser's subscription — called when the user turns alerts
    off, so a stale subscription doesn't keep paging them after they opted out."""
    result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.user_id == user.id,
            PushSubscription.endpoint == endpoint,
        )
    )
    row = result.scalar_one_or_none()
    if row is not None:
        await db.delete(row)
        await db.commit()
