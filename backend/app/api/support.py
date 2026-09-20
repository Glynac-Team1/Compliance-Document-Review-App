import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.security import require_role, Role
from app.api.documents import celery_client
from app.api.invitations import require_admin_user
from models import SupportRequest, SupportCategory, SupportRequestStatus, User

router = APIRouter(prefix="/support", tags=["support"])


class SupportRequestCreate(BaseModel):
    subject: str
    message: str
    category: SupportCategory


class SupportRequestOut(BaseModel):
    id: uuid.UUID
    subject: str
    category: SupportCategory
    status: SupportRequestStatus

    class Config:
        from_attributes = True


class SupportRequestAdminOut(BaseModel):
    id: uuid.UUID
    subject: str
    message: str
    category: SupportCategory
    status: SupportRequestStatus
    advisor_id: uuid.UUID

    class Config:
        from_attributes = True


class SupportRequestStatusUpdate(BaseModel):
    status: SupportRequestStatus


@router.post("/requests", response_model=SupportRequestOut)
async def create_support_request(
    body: SupportRequestCreate,
    token: dict = Depends(require_role(Role.advisor)),
    db: AsyncSession = Depends(get_db),
):
    advisor_id = uuid.UUID(token["sub"])
    advisor = (await db.execute(select(User).where(User.id == advisor_id))).scalar_one()

    support_request = SupportRequest(
        advisor_id=advisor.id,
        workspace_id=getattr(advisor, "workspace_id", None),
        subject=body.subject,
        message=body.message,
        category=body.category,
        status=SupportRequestStatus.submitted,
    )
    db.add(support_request)
    await db.commit()
    await db.refresh(support_request)

    admin_email = None
    if support_request.workspace_id:
        admin_email = (await db.execute(
            select(User.email).where(
                User.workspace_id == support_request.workspace_id,
                User.is_admin == True,  # noqa: E712
            )
        )).scalar_one_or_none()

    celery_client.send_task(
        "app.core.tasks.process_support_request",
        kwargs={
            "request_id": str(support_request.id),
            "advisor_email": advisor.email,
            "admin_email": admin_email,
            "subject": support_request.subject,
        },
        queue="document-analysis",
    )

    return support_request


@router.get("/admin/requests", response_model=list[SupportRequestAdminOut])
async def list_support_requests(
    admin: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SupportRequest).where(SupportRequest.workspace_id == admin.workspace_id)
    )
    return result.scalars().all()


@router.patch("/admin/requests/{request_id}", response_model=SupportRequestAdminOut)
async def update_support_request_status(
    request_id: uuid.UUID,
    body: SupportRequestStatusUpdate,
    admin: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db),
):
    support_request = (await db.execute(
        select(SupportRequest).where(
            SupportRequest.id == request_id,
            SupportRequest.workspace_id == admin.workspace_id,
        )
    )).scalar_one()

    support_request.status = body.status
    await db.commit()
    await db.refresh(support_request)
    return support_request