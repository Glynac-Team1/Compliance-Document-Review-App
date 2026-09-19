import asyncio
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.events import event_manager
from app.core.security import require_any_role
from app.core.sse_tickets import issue_ticket, redeem_ticket
from app.database import get_db
from models import Notification, Role

router = APIRouter()


@router.get("")
async def list_notifications(
    user_token: dict = Depends(require_any_role(Role.advisor, Role.officer)),
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(user_token["sub"])

    # Query notifications ordered by recency
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(desc(Notification.created_at))
        .limit(50)
    )
    notifications = result.scalars().all()

    unread_count = await db.scalar(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.is_read == False,
        )
    ) or 0

    return {
        "notifications": [
            {
                "id": str(n.id),
                "document_id": str(n.document_id) if n.document_id else None,
                "message": n.message,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat(),
            }
            for n in notifications
        ],
        "unread_count": unread_count,
    }


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: uuid.UUID,
    user_token: dict = Depends(require_any_role(Role.advisor, Role.officer)),
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(user_token["sub"])
    notification = await db.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    if notification is None:
        raise HTTPException(404, "Notification not found")

    notification.is_read = True
    await db.commit()

    unread_count = await db.scalar(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.is_read == False,
        )
    ) or 0

    return {
        "id": str(notification.id),
        "is_read": True,
        "unread_count": unread_count,
    }


@router.post("/read-all")
async def mark_all_notifications_read(
    user_token: dict = Depends(require_any_role(Role.advisor, Role.officer)),
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(user_token["sub"])
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()

    return {"message": "All notifications marked as read", "unread_count": 0}


@router.post("/stream/ticket")
async def create_stream_ticket(
    user_token: dict = Depends(require_any_role(Role.advisor, Role.officer)),
):
    user_id = uuid.UUID(user_token["sub"])
    ticket = issue_ticket(user_id)
    return {"ticket": ticket}


@router.get("/stream")
async def stream_events(
    ticket: str = Query(...),
):
    """Server-Sent Events (SSE) stream for live updates and instant notifications."""
    user_id = redeem_ticket(ticket)
    if user_id is None:
        raise HTTPException(401, "Invalid or expired ticket")

    q = event_manager.register(user_id)

    async def event_generator():
        try:
            # Emit connection acknowledgment
            yield f"data: {json.dumps({'type': 'connected'})}\n\n"
            while True:
                try:
                    # Wait for message with 25s keepalive timeout
                    msg = await asyncio.wait_for(q.get(), timeout=25.0)
                    yield f"data: {json.dumps(msg)}\n\n"
                except asyncio.TimeoutError:
                    # SSE keepalive comment
                    yield ": ping\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            event_manager.unregister(user_id, q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
