from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.core.security import require_role
from app.database import get_db
from models import Role, Document, User, Review, DocumentStatus, Decision
from pydantic import BaseModel
import uuid
from fastapi import HTTPException

advisor_router = APIRouter()
officer_router = APIRouter()

@advisor_router.get("")
async def list_my_documents(
    user_token: dict = Depends(require_role(Role.advisor)),
    db: AsyncSession = Depends(get_db)
):
    # Grab the advisor's ID from the security token
    advisor_id = user_token["sub"]
    
    # Query Postgres for all documents belonging to this advisor, newest first
    query = select(Document).where(Document.advisor_id == advisor_id).order_by(desc(Document.created_at))
    result = await db.execute(query)
    
    # Extract the results
    documents = result.scalars().all()
    
    #  Format for the frontend
    formatted_docs = []
    for doc in documents:
        formatted_docs.append({
            "id": str(doc.id),
            "filename": doc.original_filename or doc.file_reference, # use original file name or reference if not available
            "file_type": doc.file_type.upper(),
            "status": doc.status.value,
            "upload_date": doc.created_at.strftime("%b %d, %Y") # Formats to "Oct 24, 2024"
        })
        
    return {"documents": formatted_docs}

    
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
            "file_type": doc.file_type
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