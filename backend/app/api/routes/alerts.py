from fastapi import APIRouter, WebSocket, WebSocketDisconnect

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
