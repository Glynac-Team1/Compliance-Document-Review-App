import asyncio
import json
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, desc, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.security import require_any_role, decode_raw_token
from app.core.sse_tickets import issue_ticket, redeem_ticket
from app.core.events import event_manager
from models import Role, Notification, User, Document

router = APIRouter()


@router.get("")
async def list_notifications(
    workspace_id: uuid.UUID | None = Query(None),
    user_token: dict = Depends(require_any_role(Role.advisor, Role.officer)),
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(user_token["sub"])

    # Resolve active workspace: parameter -> token -> user record
    active_ws_id = workspace_id
    if not active_ws_id and user_token.get("workspace_id"):
        try:
            active_ws_id = uuid.UUID(user_token["workspace_id"])
        except (ValueError, TypeError):
            pass

    if not active_ws_id:
        user = await db.scalar(select(User).where(User.id == user_id))
        if user and user.workspace_id:
            active_ws_id = user.workspace_id

    # Query notifications strictly scoped to user and active workspace
    query = (
        select(Notification)
        .outerjoin(Document, Notification.document_id == Document.id)
        .where(Notification.user_id == user_id)
        .order_by(desc(Notification.created_at))
        .limit(50)
    )
    if active_ws_id:
        query = query.where(
            (Notification.workspace_id == active_ws_id) |
            (Document.workspace_id == active_ws_id)
        )

    result = await db.execute(query)
    notifications = result.scalars().all()

    unread_query = (
        select(func.count(Notification.id))
        .outerjoin(Document, Notification.document_id == Document.id)
        .where(
            Notification.user_id == user_id,
            Notification.is_read == False,
        )
    )
    if active_ws_id:
        unread_query = unread_query.where(
            (Notification.workspace_id == active_ws_id) |
            (Document.workspace_id == active_ws_id)
        )

    unread_count = await db.scalar(unread_query) or 0

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
    workspace_id: uuid.UUID | None = Query(None),
    user_token: dict = Depends(require_any_role(Role.advisor, Role.officer)),
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(user_token["sub"])

    active_ws_id = workspace_id
    if not active_ws_id and user_token.get("workspace_id"):
        try:
            active_ws_id = uuid.UUID(user_token["workspace_id"])
        except (ValueError, TypeError):
            pass

    if not active_ws_id:
        user = await db.scalar(select(User).where(User.id == user_id))
        if user and user.workspace_id:
            active_ws_id = user.workspace_id

    stmt = (
        update(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.is_read == False,
        )
        .values(is_read=True)
    )
    if active_ws_id:
        doc_subquery = select(Document.id).where(Document.workspace_id == active_ws_id)
        stmt = stmt.where(
            (Notification.workspace_id == active_ws_id) |
            (Notification.document_id.in_(doc_subquery))
        )

    await db.execute(stmt)
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
