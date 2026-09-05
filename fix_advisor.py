import re

with open("backend/app/api/roles.py", "r") as f:
    content = f.read()

# Replace the list_my_documents function
new_func = """@advisor_router.get("")
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
        
    return {"documents": formatted_docs}"""

content = re.sub(r'@advisor_router\.get\(""\)\nasync def list_my_documents.*?return \{"documents": formatted_docs\}', new_func, content, flags=re.DOTALL)

with open("backend/app/api/roles.py", "w") as f:
    f.write(content)
