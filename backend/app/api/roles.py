from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import aliased
from app.core.security import require_role
from app.database import get_db
from models import Role, Document, User, Review, DocumentStatus, Decision
from pydantic import BaseModel
import uuid
from app.api.documents import execute_officer_decision, is_lock_expired

advisor_router = APIRouter()
officer_router = APIRouter() 

@advisor_router.get("")
async def list_my_documents(
    user_token: dict = Depends(require_role(Role.advisor)),
    db: AsyncSession = Depends(get_db)
):
    advisor_id = uuid.UUID(str(user_token["sub"])) if "sub" in user_token else None
    advisor_workspace_id = None
    if advisor_id:
        adv_res = await db.execute(select(User.workspace_id).where(User.id == advisor_id))
        advisor_workspace_id = adv_res.scalar_one_or_none()

    ClaimingOfficer = aliased(User)
    query = (
        select(Document, ClaimingOfficer)
        .outerjoin(ClaimingOfficer, Document.locked_by_officer_id == ClaimingOfficer.id)
        .where(Document.advisor_id == advisor_id)
        .order_by(desc(Document.created_at))
    )

    if advisor_workspace_id:
        query = query.where(Document.workspace_id == advisor_workspace_id)
    else:
        query = query.where(Document.workspace_id.is_(None))

    result = await db.execute(query)
    rows = result.all()
    
    formatted_docs = []
    for doc, claiming_officer in rows:
        expired = is_lock_expired(doc)
        # For the advisor, if the document has been claimed/in review, preserve in_review unless released
        effective_claiming_officer = claiming_officer
        effective_status = doc.status.value

        # Fetch the latest review for this document
        rev_query = select(Review).where(Review.document_id == doc.id).order_by(desc(Review.decided_at)).limit(1)
        rev_result = await db.execute(rev_query)
        latest_review = rev_result.scalar_one_or_none()

        if latest_review and latest_review.comment:
            officer_comment = latest_review.comment
        elif effective_status == DocumentStatus.in_review.value:
            if effective_claiming_officer and effective_claiming_officer.name:
                officer_comment = f"Currently being reviewed by {effective_claiming_officer.name}."
            else:
                officer_comment = "Currently being reviewed by a compliance officer."
        elif effective_status == DocumentStatus.approved.value:
            officer_comment = "Approved by compliance."
        elif effective_status == DocumentStatus.rejected.value:
            officer_comment = "Rejected by compliance."
        elif effective_status == DocumentStatus.needs_revision.value:
            officer_comment = "Revisions requested by compliance."
        else:
            officer_comment = "Document received and queued for compliance review."
        
        formatted_docs.append({
            "id": str(doc.id),
            "filename": doc.original_filename or doc.file_reference,
            "file_type": doc.file_type.upper(),
            "status": effective_status,
            "upload_date": doc.created_at.strftime("%b %d, %Y"),
            "officer_comment": officer_comment,
        })
        
    return {"documents": formatted_docs}


@advisor_router.get("/notifications")
async def list_advisor_notifications(
    user_token: dict = Depends(require_role(Role.advisor)),
    db: AsyncSession = Depends(get_db)
):
    from app.api.notifications import list_notifications
    return await list_notifications(user_token=user_token, db=db)


@advisor_router.post("/notifications/{notification_id}/read")
async def mark_advisor_notification_read(
    notification_id: uuid.UUID,
    user_token: dict = Depends(require_role(Role.advisor)),
    db: AsyncSession = Depends(get_db)
):
    from app.api.notifications import mark_notification_read
    return await mark_notification_read(notification_id=notification_id, user_token=user_token, db=db)


##### officer stuff here

@officer_router.get("")
async def list_review_queue(
    user_token: dict = Depends(require_role(Role.officer)),
    db: AsyncSession = Depends(get_db)
):
    current_officer_id = None
    if "sub" in user_token:
        try:
            current_officer_id = uuid.UUID(str(user_token["sub"]))
        except ValueError:
            pass

    officer_workspace_id = None
    if current_officer_id:
        officer_res = await db.execute(select(User.workspace_id).where(User.id == current_officer_id))
        officer_workspace_id = officer_res.scalar_one_or_none()

    # Join Document with submitter (User) and optional claiming officer (ClaimingOfficer)
    ClaimingOfficer = aliased(User)
    query = (
        select(Document, User, ClaimingOfficer)
        .join(User, Document.advisor_id == User.id)
        .outerjoin(ClaimingOfficer, Document.locked_by_officer_id == ClaimingOfficer.id)
        .order_by(desc(Document.created_at))
    )

    if officer_workspace_id:
        query = query.where(Document.workspace_id == officer_workspace_id)
    else:
        query = query.where(Document.workspace_id.is_(None))

    result = await db.execute(query)
    
    current_officer_id = uuid.UUID(user_token["sub"]) if "sub" in user_token else None
    queue = []
    for doc, advisor, claiming_officer in result.all():
        expired = is_lock_expired(doc)
        is_claimed_by_me = doc.locked_by_officer_id == current_officer_id if current_officer_id else False

        if is_claimed_by_me:
            # If claimed by this officer, retain claim and in_review status so they can resume anytime
            effective_locked_by = doc.locked_by_officer_id
            effective_claiming_officer_name = claiming_officer.name if claiming_officer else None
            is_locked_by_me = True
            is_locked_by_other = False
            effective_status = doc.status.value
        else:
            effective_locked_by = None if expired else doc.locked_by_officer_id
            effective_claiming_officer_name = None if expired else (claiming_officer.name if claiming_officer else None)
            is_locked_by_me = False
            is_locked_by_other = effective_locked_by is not None
            effective_status = (
                DocumentStatus.pending.value
                if (expired and doc.status == DocumentStatus.in_review)
                else doc.status.value
            )

        queue.append({
            "id": str(doc.id),
            "name": doc.original_filename or doc.file_reference,
            "submitter": advisor.name,
            "uploaded": doc.created_at.strftime("%b %d, %Y"),
            "status": effective_status,
            "file_type": doc.file_type,
            "ai_analysis": doc.ai_analysis,
            "locked_by_officer_id": str(effective_locked_by) if effective_locked_by else None,
            "locked_by_officer_name": effective_claiming_officer_name,
            "is_locked_by_me": is_locked_by_me,
            "is_locked_by_other": is_locked_by_other,
        })
        
    return {"documents": queue}

 
class ReviewRequest(BaseModel):
    decision: Decision
    comment: str

@officer_router.post("/{document_id}/review")
async def submit_review(
    document_id: uuid.UUID,
    request: ReviewRequest,
    user_token: dict = Depends(require_role(Role.officer)),
    db: AsyncSession = Depends(get_db)
):
    officer_id = uuid.UUID(user_token["sub"])
    return await execute_officer_decision(
        db=db,
        document_id=document_id,
        officer_id=officer_id,
        decision=request.decision,
        comment=request.comment,
    )

@officer_router.get("/{document_id}/view")
async def get_document_url(
    document_id: uuid.UUID,
    user_token: dict = Depends(require_role(Role.officer)),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")

    officer_id = uuid.UUID(str(user_token["sub"])) if "sub" in user_token else None
    if officer_id and doc.workspace_id:
        officer = await db.scalar(select(User).where(User.id == officer_id))
        if officer and officer.workspace_id and officer.workspace_id != doc.workspace_id:
            raise HTTPException(status_code=403, detail="Access denied. Document belongs to another workspace.")
        
    from app.core.storage import s3_client
    from app.config import settings
    url = s3_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': settings.minio_bucket_name, 'Key': doc.file_reference},
        ExpiresIn=3600
    )
    # Rewrite the internal Docker URL to localhost so the browser can reach it
    return {"url": url.replace("http://minio:9000", "http://localhost:9000")}