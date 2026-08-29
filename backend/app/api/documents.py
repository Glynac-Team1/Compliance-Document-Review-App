from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
import magic
import asyncio

from app.core.security import require_role
from models import Role, DocumentStatus, Document
from app.config import settings
from app.database import get_db
from app.core.storage import upload_file_to_minio

router = APIRouter()

@router.post("")
async def upload_document(
    file: UploadFile, 
    user_token: dict = Depends(require_role(Role.advisor)),
    db: AsyncSession = Depends(get_db)
):
    MAX_SIZE = settings.max_upload_mb * 1024 * 1024
    file_size = 0
    contents = bytearray()

    while chunk := await file.read(1024 * 1024):
        file_size += len(chunk)
        if file_size > MAX_SIZE:
            raise HTTPException(413, f"File too large.")
        contents.extend(chunk)

    mime = magic.from_buffer(contents, mime=True)
    if mime not in settings.allowed_mime_types:
        raise HTTPException(415, f"Unsupported file type.")

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
        file_reference=file_reference,
        file_type=file_ext
    )
    
    db.add(new_document)
    await db.commit()
    await db.refresh(new_document)
    
    return {
        "document_id": str(new_document.id),
        "status": new_document.status.value, 
        "filename": file.filename
    }
