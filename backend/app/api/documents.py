from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update, select
from pydantic import BaseModel
import magic
import asyncio
import uuid

from app.core.security import require_role
from models import Role, DocumentStatus, Document, Review, Decision
from app.config import settings
from app.database import get_db
from app.core.storage import upload_file_to_minio
from celery import Celery

celery_client = Celery(broker=settings.redis_url)

router = APIRouter()


@router.post("")
async def upload_document(
    file: UploadFile,
    user_token: dict = Depends(require_role(Role.advisor)),
    db: AsyncSession = Depends(get_db)
):
    # Read the file in chunks to prevent Out-Of-Memory attacks
    MAX_SIZE = settings.max_upload_mb * 1024 * 1024
    file_size = 0
    contents = bytearray()
    while chunk := await file.read(1024 * 1024):
        file_size += len(chunk)
        if file_size > MAX_SIZE:
            raise HTTPException(413, f"File too large. Maximum size is {settings.max_upload_mb}MB.")
        contents.extend(chunk)

    # Validate MIME type (first 2048 bytes only)
    mime = magic.from_buffer(bytes(contents[:2048]), mime=True)
    if mime not in settings.allowed_mime_types:
        raise HTTPException(415, f"Unsupported file type: {mime}")

    # Stream contents to MinIO
    file_reference = await asyncio.to_thread(
        upload_file_to_minio,
        contents,
        file.filename,
        mime
    )

    file_ext = file.filename.split(".")[-1] if "." in file.filename else "unknown"

    new_document = Document(
        advisor_id=user_token["sub"],
        status=DocumentStatus.pending,
        original_filename=file.filename,
        file_reference=file_reference,
        file_type=file_ext
    )

    db.add(new_document)
    await db.commit()
    await db.refresh(new_document)

    celery_client.send_task("worker.celery_app.analyze_document", args=[str(new_document.id)])

    return {
        "document_id": str(new_document.id),
        "status": new_document.status.value,
        "filename": file.filename
    }


class DecisionRequest(BaseModel):
    decision: Decision
    comment: str


@router.post("/{document_id}/claim")
async def claim_document(
    document_id: uuid.UUID,
    token: dict = Depends(require_role(Role.officer)),
    db: AsyncSession = Depends(get_db),
):
    officer_id = uuid.UUID(token["sub"])

    result = await db.execute(
        update(Document)
        .where(
            Document.id == document_id,
            Document.status == DocumentStatus.pending,
        )
        .values(
            status=DocumentStatus.in_review,
            locked_by_officer_id=officer_id,
        )
        .returning(Document.id)
    )
    claimed_id = result.scalar_one_or_none()
    await db.commit()

    if claimed_id is None:
        exists = await db.scalar(select(Document.id).where(Document.id == document_id))
        if exists is None:
            raise HTTPException(404, "Document not found")
        raise HTTPException(409, "Document already claimed")

    return {"document_id": str(claimed_id), "status": DocumentStatus.in_review.value}


@router.post("/{document_id}/decision")
async def submit_decision(
    document_id: uuid.UUID,
    body: DecisionRequest,
    token: dict = Depends(require_role(Role.officer)),
    db: AsyncSession = Depends(get_db),
):
    officer_id = uuid.UUID(token["sub"])

    doc = await db.scalar(select(Document).where(Document.id == document_id))
    if doc is None:
        raise HTTPException(404, "Document not found")

    if doc.locked_by_officer_id != officer_id:
        raise HTTPException(409, "You have not claimed this document")

    status_map = {
        Decision.approve: DocumentStatus.approved,
        Decision.reject: DocumentStatus.rejected,
        Decision.needs_revision: DocumentStatus.needs_revision,
    }
    doc.status = status_map[body.decision]
    doc.locked_by_officer_id = None

    review = Review(
        document_id=doc.id,
        officer_id=officer_id,
        decision=body.decision,
        comment=body.comment,
    )
    db.add(review)
    await db.commit()

    return {"document_id": str(doc.id), "status": doc.status.value}