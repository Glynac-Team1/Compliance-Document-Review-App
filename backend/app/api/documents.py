from fastapi import APIRouter, Depends, HTTPException, UploadFile, Form
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update, select
from sqlalchemy.orm import aliased
from pydantic import BaseModel
import magic
import asyncio
import logging
import random
import uuid
import os
from datetime import datetime, timezone, timedelta
from models import AIAnalysis, Flag, AnalysisStatus, AuditEvent, AuditAction, User, Rule, Notification
from app.core.events import event_manager

from app.core.security import require_role, require_any_role
from models import Role, DocumentStatus, Document, Review, Decision


CLAIM_LOCK_TIMEOUT_MINUTES = 30
ANALYSIS_ENQUEUE_MAX_ATTEMPTS = 3
ANALYSIS_ENQUEUE_BASE_DELAY_SECONDS = 0.5

logger = logging.getLogger(__name__)

ALLOWED_FILE_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def is_lock_expired(doc: Document) -> bool:
    if doc.locked_by_officer_id is None:
        return False
    if doc.locked_at is None:
        return True
    now = datetime.now(timezone.utc)
    locked_at = doc.locked_at if doc.locked_at.tzinfo else doc.locked_at.replace(tzinfo=timezone.utc)
    return (now - locked_at) > timedelta(minutes=CLAIM_LOCK_TIMEOUT_MINUTES)

from app.config import settings
from app.database import get_db
from app.core.storage import upload_file_to_minio
from app.core.analysis_errors import AnalysisErrorCode, get_user_facing_message
from celery import Celery

celery_client = Celery("compliance_review", broker=settings.redis_url)

router = APIRouter()


async def enqueue_analysis(document_id: uuid.UUID) -> bool:
    """Publish analysis work with a small bounded broker retry budget."""
    for attempt in range(ANALYSIS_ENQUEUE_MAX_ATTEMPTS):
        try:
            await asyncio.to_thread(
                celery_client.send_task,
                "worker.celery_app.analyze_document",
                args=[str(document_id)],
                queue="document-analysis",
            )
            return True
        except Exception as exc:
            if attempt == ANALYSIS_ENQUEUE_MAX_ATTEMPTS - 1:
                logger.error(
                    "Analysis enqueue failed: document_id=%s attempts=%s exception_type=%s",
                    document_id,
                    ANALYSIS_ENQUEUE_MAX_ATTEMPTS,
                    type(exc).__name__,
                )
                return False
            delay = ANALYSIS_ENQUEUE_BASE_DELAY_SECONDS * (2 ** attempt)
            await asyncio.sleep(random.uniform(delay, delay * 2))
    return False


async def mark_enqueue_failed(db: AsyncSession, document_id: uuid.UUID) -> None:
    analysis = await db.scalar(select(AIAnalysis).where(AIAnalysis.document_id == document_id))
    document = await db.scalar(select(Document).where(Document.id == document_id))
    if analysis is None or document is None:
        return
    user_message = get_user_facing_message(AnalysisErrorCode.ANALYSIS_ENQUEUE_FAILED)
    analysis.status = AnalysisStatus.error
    analysis.error_code = AnalysisErrorCode.ANALYSIS_ENQUEUE_FAILED.value
    analysis.user_facing_error = user_message
    analysis.error_message = "Analysis task could not be published to the broker"
    analysis.technical_error = "Analysis task could not be published to the broker"
    analysis.summary = user_message
    analysis.generated_at = datetime.now(timezone.utc)
    document.ai_analysis = {
        "summary": user_message,
        "flags": [],
        "precedents": [],
        "degraded": True,
        "error_code": AnalysisErrorCode.ANALYSIS_ENQUEUE_FAILED.value,
        "error_type": "analysis_enqueue_failed",
        "user_facing_error": user_message,
        "manual_review_required": True,
    }
    await db.commit()


@router.post("")
async def upload_document(
    file: UploadFile,
    previous_version_id: Optional[uuid.UUID] = Form(None),
    user_token: dict = Depends(require_role(Role.advisor)),
    db: AsyncSession = Depends(get_db)
):
    advisor_id = uuid.UUID(user_token["sub"]) if isinstance(user_token["sub"], str) else user_token["sub"]

    filename = file.filename or ""
    file_ext = os.path.splitext(filename)[1].lower()
    expected_mime = ALLOWED_FILE_TYPES.get(file_ext)
    if expected_mime is None:
        raise HTTPException(415, "Unsupported file type. Only PDF, DOCX, and XLSX files are accepted.")

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
    if mime != expected_mime or mime not in settings.allowed_mime_types:
        raise HTTPException(415, f"Unsupported file type: {mime}")

    # Stream contents to MinIO
    file_reference = await asyncio.to_thread(
        upload_file_to_minio,
        contents,
        filename,
        mime
    )

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

    advisor = await db.scalar(select(User).where(User.id == advisor_id))
    advisor_name = advisor.name if advisor else "An advisor"
    advisor_workspace_id = advisor.workspace_id if advisor else None

    new_document = Document(
        id=new_doc_id,
        advisor_id=advisor_id,
        workspace_id=advisor_workspace_id,
        status=DocumentStatus.pending,
        original_filename=filename,
        file_reference=file_reference,
        file_type=file_ext.lstrip("."),
        previous_version_id=previous_version_id,
        thread_root_id=thread_root_id
    )

    db.add(new_document)
    await db.flush()

    db.add(AuditEvent(
        actor_id=advisor_id,
        document_id=new_document.id,
        action=audit_action,
    ))
    db.add(AIAnalysis(document_id=new_document.id, status=AnalysisStatus.pending))

    # Notify only compliance officers of the same workspace
    if advisor_workspace_id:
        officers_query = select(User).where(User.role == Role.officer, User.workspace_id == advisor_workspace_id)
        officers = (await db.execute(officers_query)).scalars().all()
    else:
        officers = []

    upload_msg = (
        f"{advisor_name} submitted a new revision for '{new_document.original_filename}'."
        if previous_version_id
        else f"{advisor_name} submitted '{new_document.original_filename}' for compliance review."
    )
    for off in officers:
        db.add(Notification(
            user_id=off.id,
            workspace_id=advisor_workspace_id,
            document_id=new_document.id,
            message=upload_msg,
        ))

    await db.commit()
    await db.refresh(new_document)

    # Real-time notification & auto-sync event broadcast
    await event_manager.broadcast_to_users(
        [off.id for off in officers],
        {
            "type": "notification",
            "message": upload_msg,
            "document_id": str(new_document.id),
        },
    )
    await event_manager.broadcast_all({
        "type": "sync",
        "event": "queue_updated",
        "document_id": str(new_document.id),
    })

    analysis_enqueued = await enqueue_analysis(new_document.id)
    if not analysis_enqueued:
        await mark_enqueue_failed(db, new_document.id)

    return {
        "document_id": str(new_document.id),
        "status": new_document.status.value,
        "analysis_queue_status": "queued" if analysis_enqueued else "enqueue_failed",
        "filename": filename,
        "thread_root_id": str(new_document.thread_root_id),
        "previous_version_id": str(new_document.previous_version_id) if new_document.previous_version_id else None
    }


@router.post("/{document_id}/analysis/retry")
async def retry_analysis(
    document_id: uuid.UUID,
    token: dict = Depends(require_role(Role.officer)),
    db: AsyncSession = Depends(get_db),
):
    doc = await db.scalar(select(Document).where(Document.id == document_id))
    if doc is None:
        raise HTTPException(404, "Document not found")

    officer_id = uuid.UUID(token["sub"])
    if doc.workspace_id:
        officer = await db.scalar(select(User).where(User.id == officer_id))
        if officer and officer.workspace_id and officer.workspace_id != doc.workspace_id:
            raise HTTPException(403, "Access denied. Document belongs to another workspace.")

    analysis = await db.scalar(select(AIAnalysis).where(AIAnalysis.document_id == document_id))
    if analysis is None:
        raise HTTPException(404, "No analysis found for this document")
    if analysis.error_code != AnalysisErrorCode.ANALYSIS_ENQUEUE_FAILED.value:
        raise HTTPException(409, "Only analyses that failed to enter the queue can be retried.")

    analysis.status = AnalysisStatus.pending
    analysis.error_code = None
    analysis.error_message = None
    analysis.user_facing_error = None
    analysis.technical_error = None
    analysis.summary = None
    doc.ai_analysis = None
    await db.commit()

    if not await enqueue_analysis(document_id):
        await mark_enqueue_failed(db, document_id)
        raise HTTPException(503, get_user_facing_message(AnalysisErrorCode.ANALYSIS_ENQUEUE_FAILED))

    return {"document_id": str(document_id), "status": AnalysisStatus.pending.value}



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

    doc = await db.scalar(select(Document).where(Document.id == document_id))
    if doc is None:
        raise HTTPException(404, "Document not found")

    if doc.workspace_id:
        officer = await db.scalar(select(User).where(User.id == officer_id))
        if officer and officer.workspace_id and officer.workspace_id != doc.workspace_id:
            raise HTTPException(403, "Access denied. Document belongs to another workspace.")

    if doc.status in (DocumentStatus.approved, DocumentStatus.rejected, DocumentStatus.needs_revision):
        raise HTTPException(
            409,
            f"Document is already {doc.status.value} and cannot be claimed for review."
        )

    now = datetime.now(timezone.utc)

    # Already claimed by this officer (idempotent, e.g. re-opening or page refresh)
    if doc.locked_by_officer_id == officer_id:
        doc.status = DocumentStatus.in_review
        doc.locked_at = now
        await db.commit()
        await event_manager.broadcast_all({
            "type": "sync",
            "event": "document_claimed",
            "document_id": str(doc.id),
        })
        return {
            "document_id": str(doc.id),
            "status": doc.status.value,
            "locked_by_officer_id": str(officer_id),
            "locked_at": doc.locked_at.isoformat(),
            "message": "Document already claimed by you",
        }

    # Claimed by another officer
    if doc.locked_by_officer_id is not None and doc.locked_by_officer_id != officer_id:
        if not is_lock_expired(doc):
            claimer = await db.scalar(select(User).where(User.id == doc.locked_by_officer_id))
            claimer_name = claimer.name if claimer else "another officer"
            raise HTTPException(
                409,
                f"This document is already being reviewed by {claimer_name}."
            )
        # If lock expired, allow takeover below

    # Unclaimed or previous lock expired: Claim / Take over
    doc.status = DocumentStatus.in_review
    doc.locked_by_officer_id = officer_id
    doc.locked_at = now

    db.add(AuditEvent(
        actor_id=officer_id,
        document_id=doc.id,
        action=AuditAction.claimed,
    ))

    # Notify advisor that review has started
    officer = await db.scalar(select(User).where(User.id == officer_id))
    officer_name = officer.name if officer else "A compliance officer"
    claim_msg = f"{officer_name} has started reviewing '{doc.original_filename}'."
    db.add(Notification(
        user_id=doc.advisor_id,
        workspace_id=doc.workspace_id,
        document_id=doc.id,
        message=claim_msg,
    ))

    # Automatically mark unread notifications on this document for this officer as read!
    await db.execute(
        update(Notification)
        .where(Notification.user_id == officer_id, Notification.document_id == doc.id, Notification.is_read == False)
        .values(is_read=True)
    )

    await db.commit()

    # Broadcast real-time events
    await event_manager.send_to_user(
        doc.advisor_id,
        {
            "type": "notification",
            "message": claim_msg,
            "document_id": str(doc.id),
        },
    )
    await event_manager.broadcast_all({
        "type": "sync",
        "event": "document_claimed",
        "document_id": str(doc.id),
    })

    return {
        "document_id": str(doc.id),
        "status": DocumentStatus.in_review.value,
        "locked_by_officer_id": str(officer_id),
        "locked_at": doc.locked_at.isoformat(),
        "message": "Document claimed successfully",
    }


@router.post("/{document_id}/release")
async def release_document(
    document_id: uuid.UUID,
    token: dict = Depends(require_role(Role.officer)),
    db: AsyncSession = Depends(get_db),
):
    officer_id = uuid.UUID(token["sub"])

    doc = await db.scalar(select(Document).where(Document.id == document_id))
    if doc is None:
        raise HTTPException(404, "Document not found")

    if doc.workspace_id:
        officer = await db.scalar(select(User).where(User.id == officer_id))
        if officer and officer.workspace_id and officer.workspace_id != doc.workspace_id:
            raise HTTPException(403, "Access denied. Document belongs to another workspace.")

    if doc.locked_by_officer_id is None:
        return {
            "document_id": str(doc.id),
            "status": doc.status.value,
            "message": "Document is not locked",
        }

    if doc.locked_by_officer_id != officer_id:
        raise HTTPException(403, "Cannot release document locked by another officer")

    doc.locked_by_officer_id = None
    doc.locked_at = None
    # If the document is currently in_review and not yet finalized, revert to pending so others can review
    if doc.status == DocumentStatus.in_review:
        doc.status = DocumentStatus.pending

    await db.commit()

    await event_manager.broadcast_all({
        "type": "sync",
        "event": "document_released",
        "document_id": str(doc.id),
    })

    return {
        "document_id": str(doc.id),
        "status": doc.status.value,
        "message": "Document lock released successfully",
    }



@router.post("/{document_id}/heartbeat")
async def heartbeat_document(
    document_id: uuid.UUID,
    token: dict = Depends(require_role(Role.officer)),
    db: AsyncSession = Depends(get_db),
):
    officer_id = uuid.UUID(token["sub"])

    doc = await db.scalar(select(Document).where(Document.id == document_id))
    if doc is None:
        raise HTTPException(404, "Document not found")

    if doc.workspace_id:
        officer = await db.scalar(select(User).where(User.id == officer_id))
        if officer and officer.workspace_id and officer.workspace_id != doc.workspace_id:
            raise HTTPException(403, "Access denied. Document belongs to another workspace.")

    if doc.locked_by_officer_id != officer_id:
        raise HTTPException(409, "Document lock is not held by you")

    doc.locked_at = datetime.now(timezone.utc)
    await db.commit()
    return {
        "document_id": str(doc.id),
        "status": doc.status.value,
        "locked_at": doc.locked_at.isoformat(),
        "message": "Lock heartbeat refreshed",
    }



@router.get("/{document_id}/analysis")
async def get_analysis(
    document_id: uuid.UUID,
    user_token: dict = Depends(require_role(Role.officer)),
    db: AsyncSession = Depends(get_db),
):
    doc = await db.scalar(select(Document).where(Document.id == document_id))
    if doc is None:
        raise HTTPException(404, "Document not found")

    officer_id = uuid.UUID(user_token["sub"])
    if doc.workspace_id:
        officer = await db.scalar(select(User).where(User.id == officer_id))
        if officer and officer.workspace_id and officer.workspace_id != doc.workspace_id:
            raise HTTPException(403, "Access denied. Document belongs to another workspace.")

    analysis = await db.scalar(
        select(AIAnalysis).where(AIAnalysis.document_id == document_id)
    )

    if analysis is None:
        raise HTTPException(404, "No analysis found for this document")

    doc = await db.scalar(select(Document).where(Document.id == document_id))

    if analysis.status == AnalysisStatus.pending:
        raise HTTPException(202, "Analysis is still processing")

    if analysis.status == AnalysisStatus.error:
        stored_analysis = doc.ai_analysis if doc and isinstance(doc.ai_analysis, dict) else {}
        error_code = analysis.error_code or stored_analysis.get("error_code")
        error_type = stored_analysis.get("error_type") or (
            error_code.lower() if error_code else AnalysisErrorCode.UNKNOWN_ANALYSIS_ERROR.value.lower()
        )
        summary_msg = (
            analysis.user_facing_error
            or stored_analysis.get("user_facing_error")
            or analysis.summary
            or (get_user_facing_message(error_code) if error_code else get_user_facing_message(AnalysisErrorCode.UNKNOWN_ANALYSIS_ERROR))
        )

        is_degraded = bool(
            stored_analysis.get("degraded")
            or (error_code in (AnalysisErrorCode.LLM_FAILED.value, AnalysisErrorCode.RAG_RETRIEVAL_FAILED.value, AnalysisErrorCode.EMBEDDING_FAILED.value))
            or (error_type in ("llm_failed", "ai_unavailable", "degraded"))
        )

        return {
            "summary": summary_msg,
            "flags": [],
            "precedents": [],
            "degraded": is_degraded,
            "error_type": error_type,
            "error_code": error_code,
            "user_facing_error": summary_msg,
            "manual_review_required": True,
        }

    flags_result = await db.execute(
        select(Flag, Rule.rule_key)
        .outerjoin(Rule, Flag.matched_rule_id == Rule.id)
        .where(Flag.analysis_id == analysis.id)
    )
    flag_rows = flags_result.all()

    stored_analysis = doc.ai_analysis if doc and isinstance(doc.ai_analysis, dict) else {}

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
        "precedents": stored_analysis.get("precedents", []),
    }


async def execute_officer_decision(
    db: AsyncSession,
    document_id: uuid.UUID,
    officer_id: uuid.UUID,
    decision: Decision,
    comment: str,
) -> dict:
    doc = await db.scalar(select(Document).where(Document.id == document_id))
    if doc is None:
        raise HTTPException(404, "Document not found")

    if doc.workspace_id:
        officer = await db.scalar(select(User).where(User.id == officer_id))
        if officer and officer.workspace_id and officer.workspace_id != doc.workspace_id:
            raise HTTPException(403, "Access denied. Document belongs to another workspace.")

    # Enforce claim lock: if locked by another officer, reject with 409
    if doc.locked_by_officer_id is not None and doc.locked_by_officer_id != officer_id:
        claimer = await db.scalar(select(User).where(User.id == doc.locked_by_officer_id))
        claimer_name = claimer.name if claimer else "another officer"
        raise HTTPException(
            409,
            f"This document is already being reviewed by {claimer_name}."
        )


    if doc.status == DocumentStatus.needs_revision:
        raise HTTPException(
            409,
            "Document is already marked as needs revision. A new revision must be submitted before it can be reviewed again.",
        )
    if doc.status in (DocumentStatus.approved, DocumentStatus.rejected):
        raise HTTPException(
            409,
            f"Document is already {doc.status.value} and cannot be decided again.",
        )

    # Review.document_id is unique=True in models. Review row is strictly immutable.
    existing_review = await db.scalar(select(Review).where(Review.document_id == doc.id))
    if existing_review is not None:
        raise HTTPException(
            409,
            "A review determination has already been recorded for this document version.",
        )

    status_map = {
        Decision.approve: DocumentStatus.approved,
        Decision.reject: DocumentStatus.rejected,
        Decision.needs_revision: DocumentStatus.needs_revision,
    }
    doc.status = status_map[decision]
    doc.locked_by_officer_id = None  # Release lock upon review decision
    doc.locked_at = None

    review = Review(
        document_id=doc.id,
        officer_id=officer_id,
        decision=decision,
        comment=comment,
    )
    db.add(review)

    db.add(AuditEvent(
        actor_id=officer_id,
        document_id=doc.id,
        action=AuditAction.decided,
    ))

    # Create notification for advisor
    officer = await db.scalar(select(User).where(User.id == officer_id))
    officer_name = officer.name if officer else "A compliance officer"
    status_text = decision.value.replace('_', ' ')
    decision_msg = f"Your document '{doc.original_filename}' was marked as {status_text} by {officer_name}."
    db.add(Notification(
        user_id=doc.advisor_id,
        workspace_id=doc.workspace_id,
        document_id=doc.id,
        message=decision_msg,
    ))

    # Mark any unread notifications on this document for this officer as read
    await db.execute(
        update(Notification)
        .where(Notification.user_id == officer_id, Notification.document_id == doc.id, Notification.is_read == False)
        .values(is_read=True)
    )

    await db.commit()

    # Real-time event broadcasts
    await event_manager.send_to_user(
        doc.advisor_id,
        {
            "type": "notification",
            "message": decision_msg,
            "document_id": str(doc.id),
        },
    )
    await event_manager.broadcast_all({
        "type": "sync",
        "event": "review_decided",
        "document_id": str(doc.id),
    })

    return {
        "document_id": str(doc.id),
        "status": doc.status.value,
        "message": f"Review recorded as {decision.value}",
    }



@router.post("/{document_id}/decision")
async def submit_decision(
    document_id: uuid.UUID,
    body: DecisionRequest,
    token: dict = Depends(require_role(Role.officer)),
    db: AsyncSession = Depends(get_db),
):
    officer_id = uuid.UUID(token["sub"])
    return await execute_officer_decision(
        db=db,
        document_id=document_id,
        officer_id=officer_id,
        decision=body.decision,
        comment=body.comment,
    )


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

    # Enforce workspace isolation if requester is an officer
    if caller_role == Role.officer.value and target_doc.workspace_id:
        caller = await db.scalar(select(User).where(User.id == caller_id))
        if caller and caller.workspace_id and caller.workspace_id != target_doc.workspace_id:
            raise HTTPException(403, "Access denied. Document belongs to another workspace.")

    root_id = target_doc.thread_root_id or target_doc.id

    # Retrieve all documents belonging to this thread with their review and AI analysis in a single batch query
    Reviewer = aliased(User)
    thread_query = (
        select(Document, Review, AIAnalysis, Reviewer.name)
        .outerjoin(Review, Review.document_id == Document.id)
        .outerjoin(Reviewer, Review.officer_id == Reviewer.id)
        .outerjoin(AIAnalysis, AIAnalysis.document_id == Document.id)
        .where((Document.thread_root_id == root_id) | (Document.id == root_id))
        .order_by(Document.created_at.asc())
    )
    thread_result = await db.execute(thread_query)
    rows = thread_result.all()

    versions = []
    for idx, (doc, review, ai_analysis, officer_name) in enumerate(rows, start=1):
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


@router.get("/{document_id}")
async def get_document_details(
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
    if caller_role == Role.advisor.value and target_doc.advisor_id != caller_id:
        raise HTTPException(403, "Access denied")
    if caller_role == Role.officer.value and target_doc.workspace_id:
        caller = await db.scalar(select(User).where(User.id == caller_id))
        if caller and caller.workspace_id and caller.workspace_id != target_doc.workspace_id:
            raise HTTPException(403, "Access denied. Document belongs to another workspace.")

    db.add(AuditEvent(actor_id=caller_id, document_id=target_doc.id, action=AuditAction.viewed))
    await db.commit()

    adv_res = await db.execute(select(User).where(User.id == target_doc.advisor_id))
    advisor = adv_res.scalar_one_or_none()
    advisor_name = advisor.name if advisor else "Advisor"

    claiming_officer_name = None
    if target_doc.locked_by_officer_id:
        off_res = await db.execute(select(User).where(User.id == target_doc.locked_by_officer_id))
        officer = off_res.scalar_one_or_none()
        if officer:
            claiming_officer_name = officer.name

    expired = is_lock_expired(target_doc)
    is_claimed_by_me = target_doc.locked_by_officer_id == caller_id if caller_role == Role.officer.value else False

    if is_claimed_by_me or caller_role == Role.advisor.value:
        effective_locked_by = target_doc.locked_by_officer_id
        effective_officer_name = claiming_officer_name
        is_locked_by_me = is_claimed_by_me
        is_locked_by_other = False
        effective_status = target_doc.status.value
    else:
        effective_locked_by = None if expired else target_doc.locked_by_officer_id
        effective_officer_name = None if expired else claiming_officer_name
        is_locked_by_me = False
        is_locked_by_other = effective_locked_by is not None
        effective_status = (
            DocumentStatus.pending.value
            if (expired and target_doc.status == DocumentStatus.in_review)
            else target_doc.status.value
        )

    return {
        "id": str(target_doc.id),
        "name": target_doc.original_filename or target_doc.file_reference,
        "filename": target_doc.original_filename or target_doc.file_reference,
        "submitter": advisor_name,
        "uploaded": target_doc.created_at.strftime("%b %d, %Y") if target_doc.created_at else "",
        "upload_date": target_doc.created_at.strftime("%b %d, %Y") if target_doc.created_at else "",
        "status": effective_status,
        "file_type": target_doc.file_type.upper() if target_doc.file_type else "PDF",
        "ai_analysis": target_doc.ai_analysis,
        "locked_by_officer_id": str(effective_locked_by) if effective_locked_by else None,
        "locked_by_officer_name": effective_officer_name,
        "is_locked_by_me": is_locked_by_me,
        "is_locked_by_other": is_locked_by_other,
    }

@router.get("/{document_id}/audit")
@router.get("/{document_id}/audit-log")
async def get_document_audit_trail(
    document_id: uuid.UUID,
    user_token: dict = Depends(require_any_role(Role.advisor, Role.officer)),
    db: AsyncSession = Depends(get_db),
):
    doc = await db.scalar(select(Document).where(Document.id == document_id))
    if not doc:
        raise HTTPException(404, "Document not found")

    caller_role = user_token.get("role")
    caller_id = uuid.UUID(user_token["sub"]) if isinstance(user_token["sub"], str) else user_token["sub"]
    caller = await db.scalar(select(User).where(User.id == caller_id))
    if not caller:
        raise HTTPException(401, "User not found")

    if caller_role == Role.advisor.value and doc.advisor_id != caller_id:
        raise HTTPException(403, "Access denied to audit trail")
    if caller_role == Role.officer.value and doc.workspace_id:
        if caller.workspace_id and doc.workspace_id != caller.workspace_id:
            raise HTTPException(403, "Access denied to audit trail. Document belongs to another workspace.")

    from sqlalchemy.orm import aliased
    Actor = aliased(User)
    events_res = await db.execute(
        select(AuditEvent, Actor.name, Actor.email, Actor.role)
        .join(Actor, AuditEvent.actor_id == Actor.id)
        .where(AuditEvent.document_id == document_id)
        .order_by(AuditEvent.timestamp.asc())
    )
    events = []
    legacy_entries = []
    for ev, actor_name, actor_email, actor_role in events_res.all():
        events.append({
            "id": str(ev.id),
            "action": ev.action.value,
            "timestamp": ev.timestamp.isoformat(),
            "actor": {
                "name": actor_name,
                "email": actor_email,
                "role": actor_role.value if actor_role else None,
            }
        })
        legacy_entries.append({
            "action": ev.action.value,
            "actor_name": actor_name,
            "timestamp": ev.timestamp.isoformat(),
        })
    return {
        "document_id": str(document_id),
        "audit_events": events,
        "events": legacy_entries,
    }
