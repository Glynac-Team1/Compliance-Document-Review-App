from fastapi import APIRouter, Depends, HTTPException, UploadFile, Form
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update, select
from pydantic import BaseModel
import magic
import asyncio
import uuid
from models import AIAnalysis, Flag, AnalysisStatus, AuditEvent, AuditAction, User, Rule

from app.core.security import require_role, require_any_role
from models import Role, DocumentStatus, Document, Review, Decision
from app.config import settings
from app.database import get_db
from app.core.storage import upload_file_to_minio
from celery import Celery

celery_client = Celery("compliance_review", broker=settings.redis_url)

router = APIRouter()


@router.post("")
async def upload_document(
    file: UploadFile,
    previous_version_id: Optional[uuid.UUID] = Form(None),
    user_token: dict = Depends(require_role(Role.advisor)),
    db: AsyncSession = Depends(get_db)
):
    advisor_id = uuid.UUID(user_token["sub"]) if isinstance(user_token["sub"], str) else user_token["sub"]

    # Read the file in chunks
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

    thread_root_id = None
    audit_action = AuditAction.submitted

    if previous_version_id:
        prev_result = await db.execute(select(Document).where(Document.id == previous_version_id))
        prev_doc = prev_result.scalar_one_or_none()
        if not prev_doc:
            raise HTTPException(404, "Previous version document not found")
        if prev_doc.advisor_id != advisor_id:
            raise HTTPException(403, "You cannot resubmit a document you do not own")
        if prev_doc.status != DocumentStatus.needs_revision:
            raise HTTPException(
                400,
                f"Cannot resubmit document with status '{prev_doc.status.value}'. Only documents with 'needs_revision' can be resubmitted."
            )

        thread_root_id = prev_doc.thread_root_id or prev_doc.id
        audit_action = AuditAction.resubmitted

        if prev_doc.thread_root_id is None:
            prev_doc.thread_root_id = prev_doc.id
            db.add(prev_doc)

    new_doc_id = uuid.uuid4()
    if not thread_root_id:
        thread_root_id = new_doc_id

    new_document = Document(
        id=new_doc_id,
        advisor_id=advisor_id,
        status=DocumentStatus.pending,
        original_filename=file.filename,
        file_reference=file_reference,
        file_type=file_ext,
        previous_version_id=previous_version_id,
        thread_root_id=thread_root_id
    )

    db.add(new_document)
    db.add(AuditEvent(
        actor_id=advisor_id,
        document_id=new_document.id,
        action=audit_action,
    ))
    await db.commit()
    await db.refresh(new_document)

    celery_client.send_task("worker.celery_app.analyze_document", args=[str(new_document.id)], queue="document-analysis")
    db.add(AIAnalysis(document_id=new_document.id, status=AnalysisStatus.pending))
    await db.commit()

    return {
        "document_id": str(new_document.id),
        "status": new_document.status.value,
        "filename": file.filename,
        "thread_root_id": str(new_document.thread_root_id),
        "previous_version_id": str(new_document.previous_version_id) if new_document.previous_version_id else None
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

    if claimed_id is None:
        await db.commit()
        exists = await db.scalar(select(Document.id).where(Document.id == document_id))
        if exists is None:
            raise HTTPException(404, "Document not found")
        raise HTTPException(409, "Document already claimed")

    db.add(AuditEvent(
        actor_id=officer_id,
        document_id=claimed_id,
        action=AuditAction.viewed,
    ))
    await db.commit()

    return {"document_id": str(claimed_id), "status": DocumentStatus.in_review.value}


@router.get("/{document_id}/analysis")
async def get_analysis(
    document_id: uuid.UUID,
    _: dict = Depends(require_role(Role.officer)),
    db: AsyncSession = Depends(get_db),
):
    analysis = await db.scalar(
        select(AIAnalysis).where(AIAnalysis.document_id == document_id)
    )

    if analysis is None:
        raise HTTPException(404, "No analysis found for this document")

    if analysis.status == AnalysisStatus.pending:
        raise HTTPException(202, "Analysis is still processing")

    if analysis.status == AnalysisStatus.error:
        doc = await db.scalar(select(Document).where(Document.id == document_id))
        error_type = "unsupported_for_ai"
        if doc and doc.ai_analysis and isinstance(doc.ai_analysis, dict):
            error_type = doc.ai_analysis.get("error_type", "unsupported_for_ai")

        summary_msg = analysis.summary or (
            "This file format or document structure is not supported for automated AI analysis "
            "(e.g., scanned/image-only PDF or empty file). Please proceed with manual revision."
        )

        return {
            "summary": summary_msg,
            "flags": [],
            "precedents": [],
            "error_type": error_type,
            "manual_review_required": True,
        }

    flags_result = await db.execute(
        select(Flag, Rule.rule_key)
        .outerjoin(Rule, Flag.matched_rule_id == Rule.id)
        .where(Flag.analysis_id == analysis.id)
    )
    flag_rows = flags_result.all()

    return {
        "summary": analysis.summary,
        "flags": [
            {
                "passage": f.passage_excerpt,
                "matched_rule_id": rule_key or str(f.matched_rule_id),
                "explanation": f.explanation,
                "severity": f.severity.value,
            }
            for f, rule_key in flag_rows
        ],
        "precedents": [],
    }


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

    db.add(AuditEvent(
        actor_id=officer_id,
        document_id=doc.id,
        action=AuditAction.decided,
    ))

    await db.commit()

    return {"document_id": str(doc.id), "status": doc.status.value}


@router.get("/{document_id}/thread")
async def get_document_thread(
    document_id: uuid.UUID,
    user_token: dict = Depends(require_any_role(Role.advisor, Role.officer)),
    db: AsyncSession = Depends(get_db),
):
    doc_result = await db.execute(select(Document).where(Document.id == document_id))
    target_doc = doc_result.scalar_one_or_none()
    if not target_doc:
        raise HTTPException(404, "Document not found")

    caller_role = user_token.get("role")
    caller_id = uuid.UUID(user_token["sub"]) if isinstance(user_token["sub"], str) else user_token["sub"]

    # Enforce ownership if requester is an advisor
    if caller_role == Role.advisor.value and target_doc.advisor_id != caller_id:
        raise HTTPException(403, "Access denied to this document thread")

    root_id = target_doc.thread_root_id or target_doc.id

    # Retrieve all documents belonging to this thread
    thread_query = (
        select(Document)
        .where((Document.thread_root_id == root_id) | (Document.id == root_id))
        .order_by(Document.created_at.asc())
    )
    thread_result = await db.execute(thread_query)
    docs = thread_result.scalars().all()

    versions = []
    for idx, doc in enumerate(docs, start=1):
        # Fetch review and decision details
        rev_result = await db.execute(select(Review).where(Review.document_id == doc.id))
        review = rev_result.scalar_one_or_none()

        # Fetch AI analysis status
        ai_result = await db.execute(select(AIAnalysis).where(AIAnalysis.document_id == doc.id))
        ai_analysis = ai_result.scalar_one_or_none()

        officer_name = None
        if review:
            officer_result = await db.execute(select(User).where(User.id == review.officer_id))
            officer = officer_result.scalar_one_or_none()
            if officer:
                officer_name = officer.name

        versions.append({
            "version": idx,
            "document_id": str(doc.id),
            "filename": doc.original_filename,
            "file_type": doc.file_type,
            "status": doc.status.value,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
            "previous_version_id": str(doc.previous_version_id) if doc.previous_version_id else None,
            "review": {
                "decision": review.decision.value,
                "comment": review.comment,
                "decided_at": review.decided_at.isoformat() if review.decided_at else None,
                "officer_name": officer_name,
            } if review else None,
            "ai_analysis": {
                "status": ai_analysis.status.value,
                "summary": ai_analysis.summary,
            } if ai_analysis else None,
        })

    return {
        "thread_root_id": str(root_id),
        "total_versions": len(versions),
        "versions": versions,
    }