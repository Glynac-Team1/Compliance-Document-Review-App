from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.core.security import require_role
from app.database import get_db
from models import Role, Document, User, Review, DocumentStatus, Decision, Notification
from pydantic import BaseModel
import uuid

advisor_router = APIRouter()
officer_router = APIRouter()


@advisor_router.get("")
async def list_my_documents(
    user_token: dict = Depends(require_role(Role.advisor)),
    db: AsyncSession = Depends(get_db)
):
    advisor_id = user_token["sub"]
    query = select(Document).where(Document.advisor_id == advisor_id).order_by(desc(Document.created_at))
    result = await db.execute(query)
    documents = result.scalars().all()

    formatted_docs = []
    for doc in documents:
        # Fetch the latest review for this document
        rev_query = select(Review).where(Review.document_id == doc.id).order_by(desc(Review.decided_at)).limit(1)
        rev_result = await db.execute(rev_query)
        latest_review = rev_result.scalar_one_or_none()

        formatted_docs.append({
            "id": str(doc.id),
            "filename": doc.original_filename or doc.file_reference,
            "file_type": doc.file_type.upper(),
            "status": doc.status.value,
            "upload_date": doc.created_at.strftime("%b %d, %Y"),
            "officer_comment": latest_review.comment if latest_review else "Document received and queued for compliance review."
        })

    return {"documents": formatted_docs}


@advisor_router.get("/notifications")
async def list_notifications(
    user_token: dict = Depends(require_role(Role.advisor)),
    db: AsyncSession = Depends(get_db)
):
    advisor_id = user_token["sub"]
    query = select(Notification).where(Notification.user_id == advisor_id).order_by(desc(Notification.created_at))
    result = await db.execute(query)
    notifications = result.scalars().all()

    return {
        "notifications": [
            {
                "id": str(n.id),
                "document_id": str(n.document_id),
                "message": n.message,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat(),
            }
            for n in notifications
        ]
    }


@advisor_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: uuid.UUID,
    user_token: dict = Depends(require_role(Role.advisor)),
    db: AsyncSession = Depends(get_db)
):
    advisor_id = user_token["sub"]
    notification = await db.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == advisor_id,
        )
    )
    if notification is None:
        raise HTTPException(404, "Notification not found")

    notification.is_read = True
    await db.commit()

    return {"id": str(notification.id), "is_read": True}


##### officer stuff here
@officer_router.get("")
async def list_review_queue(
    _: dict = Depends(require_role(Role.officer)),
    db: AsyncSession = Depends(get_db)
):
    # Join the Document table with the User table to show the advisor's name
    query = select(Document, User).join(User, Document.advisor_id == User.id).order_by(desc(Document.created_at))
    result = await db.execute(query)

    queue = []
    #  returns tuples of Document, User
    for doc, user in result.all():
        queue.append({
            "id": str(doc.id),
            "name": doc.original_filename or doc.file_reference,
            "submitter": user.name,
            "uploaded": doc.created_at.strftime("%b %d, %Y"),
            "status": doc.status.value,
            "file_type": doc.file_type,
            "ai_analysis": doc.ai_analysis
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
    # Find the document
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Update the document's status

    if request.decision.value == "approve":
        doc.status = DocumentStatus.approved
    elif request.decision.value == "reject":
        doc.status = DocumentStatus.rejected
    elif request.decision.value == "needs_revision":
        doc.status = DocumentStatus.needs_revision

    # Save the official review comment for the Advisor to read!
    new_review = Review(
        document_id=doc.id,
        officer_id=uuid.UUID(user_token["sub"]),
        decision=request.decision,
        comment=request.comment
    )
    db.add(new_review)

    # Commit both changes to Postgres
    await db.commit()

    return {"message": f"Review recorded as {request.decision.value}"}


@officer_router.get("/{document_id}/view")
async def get_document_url(
    document_id: uuid.UUID,
    _: dict = Depends(require_role(Role.officer)),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")

    from app.core.storage import s3_client
    from app.config import settings
    url = s3_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': settings.minio_bucket_name, 'Key': doc.file_reference},
        ExpiresIn=3600
    )
    # Rewrite the internal Docker URL to localhost so the browser can reach it
    return {"url": url.replace("http://minio:9000", "http://localhost:9000")}