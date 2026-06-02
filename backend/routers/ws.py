from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ws_manager import manager

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            # Keep connection alive; all pushes come from broadcast()
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
