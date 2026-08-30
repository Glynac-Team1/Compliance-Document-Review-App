import uuid
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_role
from app.database import get_db
from models import Role, Document

advisor_router = APIRouter()
officer_router = APIRouter()


@advisor_router.get("")
async def list_my_documents(
    token: dict = Depends(require_role(Role.advisor)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user_id = uuid.UUID(token["sub"])
    result = await db.execute(
        select(Document).where(Document.advisor_id == user_id)
    )
    documents = result.scalars().all()
    return {
        "documents": [
            {
                "id": str(doc.id),
                "file_reference": doc.file_reference,
                "file_type": doc.file_type,
                "status": doc.status.value,
                "created_at": doc.created_at.isoformat(),
            }
            for doc in documents
        ]
    }


@officer_router.get("")
async def list_review_queue(
    token: dict = Depends(require_role(Role.officer)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(select(Document))
    documents = result.scalars().all()
    return {
        "documents": [
            {
                "id": str(doc.id),
                "file_reference": doc.file_reference,
                "file_type": doc.file_type,
                "status": doc.status.value,
                "created_at": doc.created_at.isoformat(),
            }
            for doc in documents
        ]
    }
